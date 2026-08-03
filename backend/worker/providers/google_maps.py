"""Google Maps provider - wraps existing scraper."""
import asyncio
import logging
from typing import List, Optional, Dict
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class GoogleMapsProvider(BaseProvider):
    name = "Google Maps"
    slug = "google_maps"
    description = "Google Maps business discovery via Playwright browser automation"
    requires_browser = True

    async def initialize(self) -> bool:
        self._is_initialized = True
        return True

    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        from worker.scrapers.google_maps import google_maps_scraper

        results = await google_maps_scraper.search(
            query=query,
            location=location,
            max_results=max_results,
            min_rating=min_rating,
            min_reviews=min_reviews
        )

        return [self._normalize_gm(r) for r in results]

    def _normalize_gm(self, r) -> NormalizedLead:
        return NormalizedLead(
            name=r.name,
            source="google_maps",
            website=r.website or "",
            phone=r.phone or "",
            address=r.address or "",
            industry=r.category or "",
            rating=r.rating or 0.0,
            review_count=r.review_count or 0,
            opening_hours=r.opening_hours or {},
            latitude=r.latitude or 0.0,
            longitude=r.longitude or 0.0,
            google_maps_url=r.google_maps_url or "",
            metadata={"images": r.images or []},
            raw_data={
                "name": r.name,
                "category": r.category,
                "address": r.address,
                "rating": r.rating,
                "reviews": r.review_count,
            }
        )
