"""Plugin registry for managing and invoking providers with auto-loading."""
import logging
import asyncio
import importlib
import pkgutil
from pathlib import Path
from typing import Dict, List, Optional, Type, Set
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ProviderRegistry:
    """Central registry for all lead providers with auto-discovery."""

    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
        self._provider_classes: Dict[str, Type[BaseProvider]] = {}
        self._enabled_slugs: Set[str] = set()
        self._initialized = False
        self._auto_discovered = False

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
                # Find all BaseProvider subclasses in the module
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

        # Auto-discover providers first
        self.auto_discover()

        if enabled_slugs is None:
            enabled_slugs = self.list_enabled_slugs()

        for slug, provider in self._providers.items():
            if slug in enabled_slugs or not enabled_slugs:
                try:
                    await provider.initialize()
                except Exception as e:
                    logger.error(f"Failed to initialize provider {slug}: {e}")

        self._initialized = True
        logger.info(f"Initialized {len(self._providers)} providers")

    async def search_single(
        self,
        provider_slug: str,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search using a single provider."""
        provider = self.get(provider_slug)
        if not provider:
            logger.error(f"Provider not found: {provider_slug}")
            return []

        if not provider.is_ready:
            await provider.initialize()

        if not provider.is_enabled:
            logger.warning(f"Provider {provider_slug} is disabled")
            return []

        try:
            provider._track_request()
            results = await provider.search(
                query=query,
                location=location,
                max_results=max_results,
                min_rating=min_rating,
                min_reviews=min_reviews,
                **kwargs
            )
            logger.info(f"Provider {provider_slug} returned {len(results)} results")
            return results
        except Exception as e:
            provider._track_error(str(e))
            logger.error(f"Provider {provider_slug} search failed: {e}")
            return []

    async def search_all(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        providers: List[str] = None,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search across multiple providers and merge results."""
        if providers is None:
            providers = self.list_enabled_slugs()

        all_results = []
        per_provider_limit = max_results // max(len(providers), 1)

        for slug in providers:
            provider = self.get(slug)
            if not provider:
                continue

            if not provider.is_ready:
                await provider.initialize()

            if not provider.is_enabled:
                logger.debug(f"Skipping disabled provider: {slug}")
                continue

            try:
                provider._track_request()
                results = await provider.search(
                    query=query,
                    location=location,
                    max_results=per_provider_limit,
                    min_rating=min_rating,
                    min_reviews=min_reviews,
                    **kwargs
                )
                all_results.extend(results)
                logger.info(f"Provider {slug}: {len(results)} results")
            except Exception as e:
                provider._track_error(str(e))
                logger.error(f"Provider {slug} failed: {e}")
                continue

        # Deduplicate by normalized name
        seen = set()
        deduped = []
        for lead in all_results:
            key = lead.name.lower().strip()
            if key not in seen:
                seen.add(key)
                deduped.append(lead)

        logger.info(f"Total deduplicated results: {len(deduped)} from {len(all_results)} raw")
        return deduped[:max_results]

    def get_provider_info(self) -> List[Dict]:
        """Get info about all registered providers."""
        return [
            p.get_capabilities()
            for p in self._providers.values()
        ]

    def get_provider_by_slug(self, slug: str) -> Optional[Dict]:
        """Get detailed info about a specific provider."""
        provider = self.get(slug)
        if provider:
            return provider.get_capabilities()
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
        }


# Global registry instance
registry = ProviderRegistry()
