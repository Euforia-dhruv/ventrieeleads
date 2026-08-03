"""Abstract base class for all lead providers."""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
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


class BaseProvider(ABC):
    """Base class all providers must extend."""

    name: str = "Base Provider"
    slug: str = "base"
    description: str = ""
    requires_browser: bool = False
    requires_api_key: bool = False
    supported_countries: List[str] = ["*"]
    supported_cities: List[str] = []

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self._is_initialized = False

    @property
    def is_ready(self) -> bool:
        return self._is_initialized

    async def initialize(self) -> bool:
        """One-time initialization. Override if needed."""
        self._is_initialized = True
        logger.info(f"Provider {self.slug} initialized")
        return True

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

    async def details(self, company_url: str) -> Optional[Dict]:
        """Get detailed info about a specific company. Optional."""
        return None

    async def validate(self, config: Dict = None) -> bool:
        """Validate that this provider can operate with current config."""
        return True

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
