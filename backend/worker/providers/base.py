"""Abstract base class for all lead providers — extended with full capability interface."""
import logging
import hashlib
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any, Set, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class NormalizedLead:
    """Universal lead format that all providers normalize into."""
    name: str
    source: str
    website: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    country: str = ""
    area: str = ""
    industry: str = ""
    rating: float = 0.0
    review_count: int = 0
    description: str = ""
    logo_url: str = ""
    opening_hours: Dict = field(default_factory=dict)
    latitude: float = 0.0
    longitude: float = 0.0
    google_maps_url: str = ""
    social_links: Dict = field(default_factory=dict)
    metadata: Dict = field(default_factory=dict)
    raw_data: Dict = field(default_factory=dict)
    discovered_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def dedup_key(self) -> str:
        """Generate a deduplication key based on website, phone, or name."""
        parts = []
        if self.website:
            parts.append(f"w:{self.website.lower().rstrip('/').replace('https://', '').replace('http://', '').replace('www.', '')}")
        if self.phone:
            import re
            phone_clean = re.sub(r'[^\d]', '', self.phone)
            if len(phone_clean) >= 8:
                parts.append(f"p:{phone_clean}")
        if self.google_maps_url:
            parts.append(f"g:{self.google_maps_url}")
        if not parts:
            parts.append(f"n:{self.name.lower().strip()}")
        return "|".join(parts)


class BaseProvider(ABC):
    """Base class all providers must extend with full capability interface."""

    name: str = "Base Provider"
    slug: str = "base"
    description: str = ""
    requires_browser: bool = False
    requires_api_key: bool = False
    requires_auth: bool = False
    supported_countries: List[str] = ["*"]
    supported_cities: List[str] = []
    supported_industries: List[str] = ["*"]

    # Rate limiting
    requests_per_minute: int = 30
    requests_per_hour: int = 500
    requests_per_day: int = 5000

    # Pricing (0 = free, -1 = custom)
    pricing_tier: str = "free"  # free, freemium, paid, custom
    pricing_per_request: float = 0.0

    # Capability flags
    supports_map_search: bool = False
    supports_coordinates: bool = False
    supports_bounding_box: bool = False
    supports_nearby: bool = False
    supports_categories: bool = False

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self._is_initialized = False
        self._is_enabled = True
        self._request_count: int = 0
        self._error_count: int = 0
        self._last_request_time: Optional[datetime] = None
        self._last_error: Optional[str] = None
        self._total_latency_ms: float = 0.0
        self._success_count: int = 0

    @property
    def is_ready(self) -> bool:
        return self._is_initialized and self._is_enabled

    @property
    def is_enabled(self) -> bool:
        return self._is_enabled

    async def initialize(self) -> bool:
        """One-time initialization. Override if needed."""
        self._is_initialized = True
        logger.info(f"Provider {self.slug} initialized")
        return True

    async def cleanup(self) -> None:
        """Cleanup resources."""
        self._is_initialized = False
        logger.info(f"Provider {self.slug} cleaned up")

    @abstractmethod
    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search for businesses and return normalized leads."""
        pass

    async def search_by_map(
        self,
        query: str,
        lat: float,
        lng: float,
        radius_km: float = 10.0,
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search near a map point. Override if provider supports coordinates.

        Default implementation reverse-geocodes the point to a text location and
        delegates to `search()`, so directory-style providers get map parity even
        though they only understand city/area names.
        """
        try:
            from worker.services.geocode import geocode_to_location
            location = await geocode_to_location(lat, lng, radius_km)
            if not location:
                logger.warning(f"Provider {self.slug}: no location resolved for ({lat},{lng})")
                return []
            return await self.search(
                query=query,
                location=location,
                max_results=max_results,
                min_rating=min_rating,
                min_reviews=min_reviews,
                **kwargs
            )
        except Exception as e:
            logger.error(f"Provider {self.slug} search_by_map failed: {e}")
            return []

    async def search_by_bounding_box(
        self,
        query: str,
        north: float, south: float, east: float, west: float,
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search within a bounding box. Override if provider supports it."""
        return []

    async def search_nearby(
        self,
        query: str,
        lat: float, lng: float,
        radius_km: float = 5.0,
        max_results: int = 50,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search nearby a point. Override if provider supports it."""
        return []

    async def search_categories(
        self,
        category: str,
        location: str = "",
        max_results: int = 50,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search by category. Override if provider supports it."""
        return []

    async def details(self, company_url: str) -> Optional[Dict]:
        """Get detailed info about a specific company. Optional."""
        return None

    async def enrich(self, lead: NormalizedLead) -> NormalizedLead:
        """Enrich an existing lead with more data. Override if supported."""
        return lead

    async def validate(self, config: Dict = None) -> bool:
        """Validate that this provider can operate with current config."""
        if self.requires_api_key and not self.config.get("api_key"):
            logger.warning(f"Provider {self.slug} requires API key")
            return False
        return True

    async def health_check(self) -> bool:
        """Check if the provider is healthy and responding."""
        try:
            if not self._is_initialized:
                await self.initialize()
            return True
        except Exception as e:
            logger.error(f"Provider {self.slug} health check failed: {e}")
            return False

    def get_rate_limit_info(self) -> Dict[str, Any]:
        """Get current rate limit status."""
        return {
            "requests_per_minute": self.requests_per_minute,
            "requests_per_hour": self.requests_per_hour,
            "requests_per_day": self.requests_per_day,
            "total_requests": self._request_count,
            "error_count": self._error_count,
            "success_count": self._success_count,
            "last_error": self._last_error,
            "avg_latency_ms": round(self._total_latency_ms / max(self._success_count, 1), 1),
        }

    def get_pricing_info(self) -> Dict[str, Any]:
        """Get pricing information."""
        return {
            "tier": self.pricing_tier,
            "per_request": self.pricing_per_request,
        }

    def get_capabilities(self) -> Dict[str, Any]:
        """Get provider capabilities."""
        return {
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "requires_browser": self.requires_browser,
            "requires_api_key": self.requires_api_key,
            "requires_auth": self.requires_auth,
            "supported_countries": self.supported_countries,
            "supported_cities": self.supported_cities,
            "supported_industries": self.supported_industries,
            "supports_map_search": self.supports_map_search,
            "supports_coordinates": self.supports_coordinates,
            "supports_bounding_box": self.supports_bounding_box,
            "supports_nearby": self.supports_nearby,
            "supports_categories": self.supports_categories,
            "pricing": self.get_pricing_info(),
            "rate_limits": self.get_rate_limit_info(),
            "is_ready": self.is_ready,
            "is_enabled": self.is_enabled,
        }

    def supports_location(self, country: str = "", city: str = "") -> bool:
        """Check if provider supports a specific location."""
        if "*" in self.supported_countries:
            return True
        if country and country.upper() in [c.upper() for c in self.supported_countries]:
            return True
        if city and city.lower() in [c.lower() for c in self.supported_cities]:
            return True
        return not country and not city

    def supports_website(self) -> bool:
        """Provider can return website URLs."""
        return True

    def supports_email(self) -> bool:
        """Provider can return email addresses."""
        return True

    def supports_phone(self) -> bool:
        """Provider can return phone numbers."""
        return True

    def supports_socials(self) -> bool:
        """Provider can return social media links."""
        return True

    def enable(self) -> None:
        """Enable this provider."""
        self._is_enabled = True
        logger.info(f"Provider {self.slug} enabled")

    def disable(self) -> None:
        """Disable this provider."""
        self._is_enabled = False
        logger.info(f"Provider {self.slug} disabled")

    def _track_request(self) -> None:
        """Track a request for rate limiting."""
        self._request_count += 1
        self._last_request_time = datetime.utcnow()

    def _track_success(self, latency_ms: float) -> None:
        """Track a successful request."""
        self._success_count += 1
        self._total_latency_ms += latency_ms

    def _track_error(self, error: str) -> None:
        """Track an error."""
        self._error_count += 1
        self._last_error = error

    def normalize(self, raw_data: Dict) -> NormalizedLead:
        """Override to provide custom normalization logic."""
        return NormalizedLead(
            name=raw_data.get("name", ""),
            source=self.slug,
            website=raw_data.get("website", ""),
            phone=raw_data.get("phone", ""),
            email=raw_data.get("email", ""),
            address=raw_data.get("address", ""),
            city=raw_data.get("city", ""),
            country=raw_data.get("country", ""),
            industry=raw_data.get("industry", raw_data.get("category", "")),
            rating=float(raw_data.get("rating", 0) or 0),
            review_count=int(raw_data.get("review_count", raw_data.get("reviews", 0)) or 0),
            description=raw_data.get("description", ""),
            logo_url=raw_data.get("logo_url", ""),
            opening_hours=raw_data.get("opening_hours", {}),
            latitude=float(raw_data.get("latitude", 0) or 0),
            longitude=float(raw_data.get("longitude", 0) or 0),
            social_links=raw_data.get("social_links", {}),
            metadata=raw_data.get("metadata", {}),
            raw_data=raw_data,
        )

    def _parse_rating(self, value) -> float:
        """Safely parse a rating value."""
        try:
            return float(value or 0)
        except (ValueError, TypeError):
            return 0.0

    def _parse_review_count(self, value) -> int:
        """Safely parse a review count, handling commas and text."""
        import re
        if not value:
            return 0
        text = str(value)
        numbers = re.sub(r'[^\d]', '', text)
        return int(numbers) if numbers else 0

    def __repr__(self):
        return f"<{self.__class__.__name__} slug={self.slug}>"
