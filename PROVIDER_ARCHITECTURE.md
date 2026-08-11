# Provider Architecture — AI Lead Discovery Backend

**File:** `backend/worker/providers/`
**Status:** verified 2026-08-08 — the system is real and functional. This doc records how it works so new providers/agents are added correctly, and where the gaps are.

---

## 1. Core model (`base.py`)

### `NormalizedLead` (dataclass)
Universal lead format every provider produces. Key fields + `dedup_key()`:
- website (normalized: strips scheme + `www.`), phone (digits-only, ≥8 chars), `google_maps_url`, else `name`.
- `to_dict()` for serialization.

### `BaseProvider` (ABC)
Every provider must implement:
- `name`, `slug`, `description` (metadata)
- **Required fields for map/list filters:**
  - `requires_api_key`, `requires_browser`, `requires_auth`
  - `supported_countries` (list or `["*"]`), `supported_cities`, `supported_industries`
  - rate-limit attributes: `requests_per_minute/hour/day`
  - `pricing_tier` + `pricing_per_request`
  - capability flags: `supports_map_search`, `supports_coordinates`, `supports_bounding_box`, `supports_nearby`, `supports_categories`
- **abstract method** `search(query, location, max_results, min_rating, min_reviews)` -> `List[NormalizedLead]`
- **optional map methods** (default to `[]`):
- `search_by_map(query, lat, lng, radius_km, ...)` — default reverse-geocodes coords → text location and delegates to `search()` (so directory providers get map parity); override for true coordinate search.
- `search_by_bounding_box(query, north, south, east, west, ...)`
  - `search_nearby(...)`
  - `search_categories(category, location, ...)`
- `details(company_url)`, `enrich(lead)`, `validate(config)`, `health_check()`
- tracking helpers: `_track_request`, `_track_success`, `_track_error`
- `get_capabilities()`, `get_pricing_info()`, `get_rate_limit_info()`

## 2. Registry (`registry.py`)

- **Auto-discovery** (`auto_discover`): import every module in package; register subclasses of `BaseProvider` (excludes `base`, `registry`).
- **Lazy instantiation**: `get(slug)` instantiates on first use.
- **Enabled control**: DB `AdminSetting["enabled_providers"]` (falls back to `["google_maps"]`).
- **Search**:
  - `search_single(slug, ...)` — per-provider with retry (2^attempt backoff), caching (TTL 300s), request/error tracking, latency stats.
  - `search_all(...)` — parallel fan-out with per-provider split limit, retry, optional rescue `fallback_providers`, cross-provider dedup via `_deduplicate`.
- **Stats/api**: `get_provider_info()`, `get_stats()`, `health_check_all()`, `enrich_lead()`.
- **Cache** `_Cache(ttl=300)` — keyed on `method:query:location:max` MD5; used only if `use_cache` and results non-empty.

## 3. Current providers scale (verified)

Auto-discovered modules (28):
```
apify, apollo, builtwith, calendly, clutch, contra, crunchbase, designrush,
dubai_directory, google_maps, google_maps_scraper_kit, goodfirms, hunter,
instascrape, instant_data_scraper, loom, outscraper, peopleperhour,
phantombuster, scrapling, scout, wappalyzer, yello_uae
```
(`google_maps` adds `map` methods; `outscraper`, `apify` are hosted API wrappers; the rest are directories/API-key).

## 4. How a search flows to the DB

1. `POST /api/search` (Node) → `searchController.createSearchJob` → inserts row in `search_jobs` → posts `{task: 'worker.tasks.search.discover_businesses', args:[jobId]}` to task-enqueuer.
2. Celery task `discover_businesses` (in `worker/tasks/search.py`):
   - reads job → builds `query` from `industry + keyword` + `location` (area/city/country)
   - reads `extra_data.lat/lng/radius_km` passed down (from the `lat`/`lng` request fields)
   - runs `registry.search_all` (parallel) or, if a single `provider`, `search_single`/`search_by_map`.
   - dedupes against DB by website/phone/name/google_maps_url, upserts `Company`
   - inserts `SearchResult` (marking `is_duplicate`) → final `process_company` batch enqueue.
2. Batch CSSA also triggers `process_company` (scraping screenshot, enrichment).

## 5. Gaps / implementation recommendations (for the map phases)

1. **Map capability parity** — ✅ FIXED (2026-08-09). Added `ReverseGeocoder` (`worker/services/geocode.py`, Nominatim online + offline nearest-city fallback). `BaseProvider.search_by_map` now default reverse-geocodes coords → text location and delegates to `search()`. Enabled `supports_map_search` on `yello_uae`, `dubai_directory`, `goodfirms`, `clutch`, `designrush`. `registry.search_single`/`search_all` now route coords searches to `search_by_map` whenever the provider claims `supports_map_search`, and coords are included in the cache key so map/text results don't collide.
2. **Geocoder** — ✅ FIXED (2026-08-09) via `worker/services/geocode.py` (reverse geocoding lat/lng → "City, CountryCode"). Forward-geocode (place name → coords) still not wired; the frontend already produces `lat/lng/radius` from the map draw, so only reverse was needed.
3. **Provider for `google_maps_scraper_kit` and `instant_data_scraper`**: confirm they wire to actual working services; if not, keep only as disabled by default.
4. **API-key flow**: `requires_api_key` is referenced, but `validate()` only checks presence — ensure provider settings surface keys from `AdminSetting` (not `.env` only).

## 6. Adding a new provider (repeatable checklist)

1. Create `worker/providers/<slug>.py`.
2. Subclass `BaseProvider`; implement `search()` (+ map methods if applicable).
3. Set identity + capability flags + pricing + limits + supported countries/cities/industries.
4. Normalize into `NormalizedLead` (set `google_maps_url`, coords, etc.).
5. Registry: nothing else needed — auto-discovery handles it.
6. Add to `enabled_providers` AdminSetting to go live; add `health_check()`.