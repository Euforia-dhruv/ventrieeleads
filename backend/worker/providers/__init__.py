"""Provider plugin system for multi-source lead discovery."""
from worker.providers.base import BaseProvider, NormalizedLead
from worker.providers.registry import ProviderRegistry, registry

__all__ = ["BaseProvider", "NormalizedLead", "ProviderRegistry", "registry"]

# Auto-discover all providers in this package
registry.auto_discover()
