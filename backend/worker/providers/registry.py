"""Plugin registry for managing and invoking providers with auto-loading, parallel execution, retry, and fallback."""
import logging
import asyncio
import time
import hashlib
import importlib
import pkgutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, Set, Tuple
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class _Cache:
    """Simple in-memory TTL cache for provider results."""

    def __init__(self, ttl_seconds: int = 300):
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            ts, val = self._store[key]
            if time.time() - ts < self._ttl:
                return val
            del self._store[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.time(), value)

    def clear(self) -> None:
        self._store.clear()

    def cleanup(self) -> int:
        """Remove expired entries, return count removed."""
        now = time.time()
        expired = [k for k, (ts, _) in self._store.items() if now - ts >= self._ttl]
        for k in expired:
            del self._store[k]
        return len(expired)


class ProviderRegistry:
    """Central registry for all lead providers with auto-discovery, parallel search, retry, and fallback."""

    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
        self._provider_classes: Dict[str, Type[BaseProvider]] = {}
        self._enabled_slugs: Set[str] = set()
        self._initialized = False
        self._auto_discovered = False
        self._cache = _Cache(ttl_seconds=300)
        self._search_stats: Dict[str, Dict] = {}

    def register(self, provider: BaseProvider) -> None:
        """Register a provider instance."""
        self._providers[provider.slug] = provider
        logger.info(f"Registered provider: {provider.slug} ({provider.name})")

    def register_class(self, slug: str, cls: Type[BaseProvider]) -> None:
        """Register a provider class for lazy instantiation."""
        self._provider_classes[slug] = cls

    def auto_discover(self) -> None:
        """Auto-discover and register all providers in the providers package."""
        if self._auto_discovered:
            return

        package_dir = Path(__file__).parent
        for _, module_name, _ in pkgutil.iter_modules([str(package_dir)]):
            if module_name.startswith("_") or module_name in ("base", "registry"):
                continue

            try:
                module = importlib.import_module(f"worker.providers.{module_name}")
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (
                        isinstance(attr, type)
                        and issubclass(attr, BaseProvider)
                        and attr is not BaseProvider
                        and hasattr(attr, "slug")
                        and attr.slug != "base"
                    ):
                        self.register_class(attr.slug, attr)
                        logger.info(f"Auto-discovered provider: {attr.slug} from {module_name}")
            except Exception as e:
                logger.error(f"Failed to auto-discover provider from {module_name}: {e}")

        self._auto_discovered = True

    def get(self, slug: str) -> Optional[BaseProvider]:
        """Get a provider by slug."""
        if slug in self._providers:
            return self._providers[slug]
        if slug in self._provider_classes:
            provider = self._provider_classes[slug]()
            self._providers[slug] = provider
            return provider
        return None

    def list_all(self) -> List[BaseProvider]:
        """List all registered providers."""
        return list(self._providers.values())

    def list_active(self) -> List[BaseProvider]:
        """List only enabled and ready providers."""
        return [p for p in self._providers.values() if p.is_ready]

    def list_enabled_slugs(self) -> List[str]:
        """Get slugs of all enabled providers from DB config."""
        try:
            from worker.models.database import get_db_context
            from worker.models import AdminSetting

            with get_db_context() as db:
                setting = db.query(AdminSetting).filter(
                    AdminSetting.key == 'enabled_providers'
                ).first()
                if setting and setting.value:
                    if isinstance(setting.value, list):
                        return setting.value
                    return ["google_maps"]
        except Exception:
            pass
        return ["google_maps"]

    def set_enabled(self, slugs: List[str]) -> None:
        """Set which providers are enabled."""
        self._enabled_slugs = set(slugs)
        for slug, provider in self._providers.items():
            if slug in slugs:
                provider.enable()
            else:
                provider.disable()

    async def initialize_all(self, enabled_slugs: List[str] = None) -> None:
        """Initialize all enabled providers."""
        if self._initialized:
            return

        self.auto_discover()

        if enabled_slugs is None:
            enabled_slugs = self.list_enabled_slugs()

        for slug, cls in self._provider_classes.items():
            if slug not in self._providers:
                self._providers[slug] = cls()

        init_tasks = []
        for slug, provider in self._providers.items():
            if slug in enabled_slugs or not enabled_slugs:
                init_tasks.append(self._safe_init(provider))

        if init_tasks:
            await asyncio.gather(*init_tasks)

        self._initialized = True
        logger.info(f"Initialized {len(self._providers)} providers")

    async def _safe_init(self, provider: BaseProvider) -> None:
        try:
            await provider.initialize()
        except Exception as e:
            logger.error(f"Failed to initialize provider {provider.slug}: {e}")

    def _get_cache_key(self, method: str, **kwargs) -> str:
        """Generate cache key for a search call."""
        raw = f"{method}:{kwargs.get('query', '')}:{kwargs.get('location', '')}:{kwargs.get('max_results', 50)}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def search_single(
        self,
        provider_slug: str,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        retries: int = 2,
        use_cache: bool = True,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search using a single provider with retry."""
        cache_key = self._get_cache_key(
            f"single:{provider_slug}",
            query=query, location=location, max_results=max_results
        )
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {provider_slug}")
                return cached

        provider = self.get(provider_slug)
        if not provider:
            logger.error(f"Provider not found: {provider_slug}")
            return []

        if not provider.is_ready:
            await provider.initialize()

        if not provider.is_enabled:
            logger.warning(f"Provider {provider_slug} is disabled")
            return []

        last_error = None
        for attempt in range(retries + 1):
            try:
                start = time.time()
                provider._track_request()
                results = await provider.search(
                    query=query,
                    location=location,
                    max_results=max_results,
                    min_rating=min_rating,
                    min_reviews=min_reviews,
                    **kwargs
                )
                latency = (time.time() - start) * 1000
                provider._track_success(latency)
                logger.info(f"Provider {provider_slug} returned {len(results)} results in {latency:.0f}ms")

                self._record_stats(provider_slug, True, latency, len(results))

                if use_cache and results:
                    self._cache.set(cache_key, results)

                return results
            except Exception as e:
                last_error = e
                provider._track_error(str(e))
                self._record_stats(provider_slug, False, 0, 0)
                if attempt < retries:
                    wait = min(2 ** attempt, 10)
                    logger.warning(f"Provider {provider_slug} attempt {attempt + 1} failed, retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)

        logger.error(f"Provider {provider_slug} failed after {retries + 1} attempts: {last_error}")
        return []

    async def search_all(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        providers: List[str] = None,
        parallel: bool = True,
        retries: int = 2,
        use_cache: bool = True,
        fallback_providers: List[str] = None,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search across multiple providers in parallel with retry, fallback, and deduplication."""
        if providers is None:
            providers = self.list_enabled_slugs()

        per_provider_limit = max(max_results // max(len(providers), 1), 10)

        if parallel:
            search_tasks = []
            for slug in providers:
                provider = self.get(slug)
                if not provider or not provider.is_enabled:
                    continue
                search_tasks.append(self._search_with_retry(
                    slug, query, location, per_provider_limit,
                    min_rating, min_reviews, retries, use_cache, **kwargs
                ))

            if search_tasks:
                results_per_provider = await asyncio.gather(*search_tasks, return_exceptions=True)
            else:
                results_per_provider = []
        else:
            results_per_provider = []
            for slug in providers:
                result = await self._search_with_retry(
                    slug, query, location, per_provider_limit,
                    min_rating, min_reviews, retries, use_cache, **kwargs
                )
                results_per_provider.append(result)

        all_results = []
        for r in results_per_provider:
            if isinstance(r, list):
                all_results.extend(r)
            elif isinstance(r, Exception):
                logger.error(f"Provider search exception: {r}")

        if not all_results and fallback_providers:
            logger.info(f"No results from primary providers, trying fallback: {fallback_providers}")
            for slug in fallback_providers:
                results = await self._search_with_retry(
                    slug, query, location, max_results,
                    min_rating, min_reviews, retries, use_cache, **kwargs
                )
                if results:
                    all_results.extend(results)
                    break

        deduped = self._deduplicate(all_results, max_results)
        logger.info(f"Total: {len(deduped)} unique from {len(all_results)} raw across {len(providers)} providers")
        return deduped

    async def _search_with_retry(
        self,
        provider_slug: str,
        query: str,
        location: str,
        max_results: int,
        min_rating: float,
        min_reviews: int,
        retries: int,
        use_cache: bool,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search a single provider with retry, used by search_all."""
        return await self.search_single(
            provider_slug=provider_slug,
            query=query,
            location=location,
            max_results=max_results,
            min_rating=min_rating,
            min_reviews=min_reviews,
            retries=retries,
            use_cache=use_cache,
            **kwargs
        )

    def _deduplicate(self, results: List[NormalizedLead], max_results: int) -> List[NormalizedLead]:
        """Deduplicate by website, phone, place_id, then name."""
        seen_keys: Set[str] = set()
        deduped: List[NormalizedLead] = []

        for lead in results:
            key = lead.dedup_key()
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(lead)

        return deduped[:max_results]

    def _record_stats(self, provider_slug: str, success: bool, latency_ms: float, result_count: int) -> None:
        """Record search stats for a provider."""
        if provider_slug not in self._search_stats:
            self._search_stats[provider_slug] = {
                "total_searches": 0,
                "successes": 0,
                "failures": 0,
                "total_results": 0,
                "total_latency_ms": 0.0,
                "avg_latency_ms": 0.0,
                "success_rate": 0.0,
            }
        stats = self._search_stats[provider_slug]
        stats["total_searches"] += 1
        stats["total_results"] += result_count
        stats["total_latency_ms"] += latency_ms
        if success:
            stats["successes"] += 1
        else:
            stats["failures"] += 1
        total = stats["total_searches"]
        stats["avg_latency_ms"] = round(stats["total_latency_ms"] / max(total, 1), 1)
        stats["success_rate"] = round(stats["successes"] / max(total, 1) * 100, 1)

    def get_provider_info(self) -> List[Dict]:
        """Get info about all registered providers."""
        return [
            {**p.get_capabilities(), "stats": self._search_stats.get(p.slug, {})}
            for p in self._providers.values()
        ]

    def get_provider_by_slug(self, slug: str) -> Optional[Dict]:
        """Get detailed info about a specific provider."""
        provider = self.get(slug)
        if provider:
            return {**provider.get_capabilities(), "stats": self._search_stats.get(slug, {})}
        return None

    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all providers."""
        results = {}
        for slug, provider in self._providers.items():
            try:
                results[slug] = await provider.health_check()
            except Exception as e:
                logger.error(f"Health check failed for {slug}: {e}")
                results[slug] = False
        return results

    async def get_stats(self) -> Dict:
        """Get aggregate stats from all providers."""
        total_requests = 0
        total_errors = 0
        for provider in self._providers.values():
            info = provider.get_rate_limit_info()
            total_requests += info["total_requests"]
            total_errors += info["error_count"]

        return {
            "total_providers": len(self._providers),
            "active_providers": len(self.list_active()),
            "enabled_slugs": list(self._enabled_slugs),
            "total_requests": total_requests,
            "total_errors": total_errors,
            "search_stats": dict(self._search_stats),
            "cache_size": len(self._cache._store),
        }

    async def enrich_lead(self, lead: NormalizedLead, provider_slugs: List[str] = None) -> NormalizedLead:
        """Enrich a lead using available providers."""
        if provider_slugs is None:
            provider_slugs = self.list_enabled_slugs()

        for slug in provider_slugs:
            provider = self.get(slug)
            if not provider or not provider.is_enabled or not provider.is_ready:
                continue
            try:
                enriched = await provider.enrich(lead)
                if enriched and enriched != lead:
                    return enriched
            except Exception as e:
                logger.debug(f"Enrichment failed from {slug}: {e}")

        return lead


# Global registry instance
registry = ProviderRegistry()
