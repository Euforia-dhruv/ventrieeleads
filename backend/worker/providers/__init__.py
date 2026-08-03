"""Provider plugin system for multi-source lead discovery."""
from worker.providers.base import BaseProvider, NormalizedLead
from worker.providers.registry import ProviderRegistry, registry
from worker.providers.google_maps import GoogleMapsProvider
from worker.providers.clutch import ClutchProvider
from worker.providers.designrush import DesignRushProvider
from worker.providers.goodfirms import GoodFirmsProvider
from worker.providers.dubai_directory import DubaiDirectoryProvider
from worker.providers.yello_uae import YelloUAEProvider

__all__ = ["BaseProvider", "NormalizedLead", "ProviderRegistry", "registry"]

for _cls in [
    GoogleMapsProvider,
    ClutchProvider,
    DesignRushProvider,
    GoodFirmsProvider,
    DubaiDirectoryProvider,
    YelloUAEProvider,
]:
    registry.register_class(_cls.slug, _cls)
