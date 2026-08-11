# Scraper / Provider Comparison — Worldwide Business Discovery

**Date:** 2026-08-08
**Purpose:** Evaluate the providers the platform uses (and realistic production options) for worldwide + map-based business discovery, so we (a) know what actually works today in the codebase, (b) pick production-grade primary/fallback strategies, (c) avoid legal/pricing surprises.

Method: verified against official docs / GitHub / PyPI pages at time of writing. Anything unverifiable is marked `unverified`.

---

## 1. What the codebase has today

All providers live in `backend/worker/providers/` and are auto-discovered by `registry.py`. The registry drives:
- `search()`  — keyword + location (text)
- `search_by_map(lat, lng, radius_km)` — coordinate circle (Google Maps supports true radius via browser; most others via center-point text query)
- `search_by_bounding_box(north, south, east, west)` — rectangle (delegates to center-point today)
- `search_categories()` — category listings

Current provider inventory (28 auto-discovered modules): `apify, apollo, builtwith, calendly, clutch, contra, crunchbase, designrush, dubai_directory, google_maps, google_maps_scraper_kit, goodfirms, hunter, instascrape, instant_data_scraper, loom, outscraper, peopleperhour, phantombuster, scrapling, scout, wappalyzer, yello_uae` (+ `registry`, `base`).

### Functional (verified reading source)
- **google_maps** — full `search_by_map` (coords), bounding box, categories. Wraps `worker/scrapers/google_maps.py` (browser-based, Lightpanda primary / Playwright fallback).
- **outscraper** — API client wrapper around the hosted Outscraper service.
- **apify** — Apify REST actor wrapper (run actor, fetch dataset).
- **hunter, apollo, builtwith, wappalyzer, crunchbase** — API-key-driven enrichment-style providers.
- **dubai_directory, yello_uae, clutch, goodfirms, designrush, contra, peopleperhour, loom** — directory scrapers.

---

## 2. Deep-dive on the free / world-wide options (2026 state)

### 2.1 `gosom/google-maps-scraper` — ⭐ recommended free/primary
- **What:** Open-source Google Maps scraper (Go). MIT. CLI, Web UI, REST API, optional self-hosted SaaS edition.
- **Data points (33+):** name, address, phone, website, email (optional website crawl), ratings, review count, coordinates, hours, opening-time, photos, place URL.
- **Interfaces we could use:** REST API + `leadsdb (Apache Parquet)` output, PostgreSQL output, S3.
- **Performance:** ≈120 places/min with concurrency; proxy rotation (SOCKS5/HTTP/HTTPS) built in.
- **Cost:** Free (self-host). SaaS edition self-hostable.
- **Map-formats:** keyword search per location; supports city/region targeting; coordinate search by URL.
- **Caveats:** scraping Google Maps UI — must self-host and manage proxy/IP pool; Google rate-limits aggressive sessions.

### 2.2 `rahul-bhatt43/maps-scrapper` — Playwright alternative
- Playwright headless Chromium, no API key, CLI + MCP server (`search_google_maps_places` tool).
- MIT. Returns places in JSON/CSV; good for pulling queries+locations (not pure coords).
- Low-volume / personal use; explicitly warns about Google ToS & blocking.

### 2.3 `noworneverev/google-maps-scraper` — async Python, field extraction
- Python + Playwright (Firefox) + asyncio, no API key, batch + concurrency + crash-recovery.
- Extracts 20+ fields incl. coordinates + plus codes. **New**, smaller community. Useful as a library-level reference for our own scraper, not a drop-in dependency to trust long-term.

### 2.4 `FAAQJAVED/Google-Maps-Business-Scraper` — enrichment logic reference
- Playwright maps scraping + HTTP enrichment; Cloudflare email XOR-decoding; ±15-thread enrichment; dedup by name+address; Excel output. Good inspiration for our `enrich`/email-decode logic but heavy (openpyxl) for our stack.

### 2.5 Outscraper (service + Python SDK)
- **Free tier:** credits/month (see outscraper.com pricing — markdown). Paid per-request.
- **Data:** returns emails, phones, websites, socials, hours, coordinates, price level. Battles once map block solves Google above — this is a hosted anti-block service, stable high quality.
- **Rate limits / cost:** per-request credits; "unverified" exact limits at write time.

### 2.6 Scrapling
- Async (asyncio+curl-cffi) scraping lib, successor-oriented to Scrapy; excellent for plain-HTML directories (goodfirms/clutch/dubai), not a Google-Maps-specific places API. Good for our **directory** scrapers.

### 2.7 Apify Google-Maps actors
- Free trial credits; then ~$0.01–0.05/listing. Handles proxy/anti-bot; supports `query`+`maxResults`+`language`, full field set including GPS. Best hosted fallback.

### 2.8 Google Cloud Places API (official)
- ~$17/1000 calls (text+details), requires billing & API key, strictly ToS-safe. Use only for high-value queries, not bulk discovery.

---

## 3. Recommendation ranking (production)

| Rank | Choice | Use case | Cost | ToS risk | Map-formats |
|---|---|---:|---:|---:|---:|
| 1 | **`gosom/google-maps-scraper`** (self-host REST) | primary worldwide text+coord search | $0 (self-host/infra proxies) | Medium (Google UI) | coords Y, bbox via center, nearby Y |
| 2 | **Outscraper** (hosted) | managed alternative — reliable, includes enrichment | per-request | Low (usage T&C) | coords Y |
| 3 | **Apify Google Maps actor** | scale-out burst / fallback | ~$0.01–0.05/listing | Low | coords Y |
| 4 | **Google Places API** (official) | verified canonical lookups, geocoding | $17/1K | None (official) | coords Y, true-text- Y |
| 5 | **Directory scrapers** (dubai_directory, goodfirms, clutch…) | niche UAE + B2B directories; complements Maps | free (opperate) | low | coords ✗ (some lat/lng fields) |

**Winner for `worldwide-map`:** first enable the self-hosted `gosom` engine as the primary (add container, connect its REST API) and keep Outscraper as the enabled hosted provider. The existing `google_maps` browser provider stays as Lightpanda/Playwright fallback. This combination gives coordinated worldwide search + free tier.

---

## 4. Next code-level action

1. (done earlier) keep `outscraper`/`google_maps` routers.
2. (✅ done 2026-08-09) Provider map parity — `search_by_map` now works on every directory provider via a shared reverse-geocoder (`worker/services/geocode.py`, Nominatim + offline nearest-city fallback). Directory providers use coords → text location; `registry.search_all`/`search_single` route coords searches to `search_by_map` whenever `supports_map_search` is set, and coords are part of the cache key.
3. (done) Added a reverse geocoder (Nominatim for OSM with local gazetteer fallback) so the frontend map "place/Circle" → panel produces the (lat,lng,radius) payload the backend coords path already reads (`search.py`: `extra.lat/lng/radius_km`). Forward geocoding (name → coords) is the remaining optional piece.

Facts marked `unverified` where a concrete number was not confirmed on the primary page at write time — do not hard-code them into pricing UI.