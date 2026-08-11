"""Google Maps provider — wraps existing scraper with Lightpanda primary, Playwright fallback."""
import asyncio
import logging
from typing import List, Optional, Dict
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class GoogleMapsProvider(BaseProvider):
    name = "Google Maps"
    slug = "google_maps"
    description = "Google Maps business discovery — Lightpanda browser primary, Playwright fallback"
    requires_browser = True
    supports_map_search = True
    supports_coordinates = True
    supports_bounding_box = True
    supports_nearby = True
    supports_categories = True

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
            min_reviews=min_reviews,
            lat=kwargs.get("lat", 0),
            lng=kwargs.get("lng", 0)
        )

        return [self._normalize_gm(r) for r in results]

    async def search_by_map(
        self,
        query: str,
        lat: float, lng: float,
        radius_km: float = 10.0,
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        from worker.scrapers.google_maps import google_maps_scraper
        results = await google_maps_scraper.search(
            query=query, location=f"{lat},{lng}",
            max_results=max_results, min_rating=min_rating, min_reviews=min_reviews,
            lat=lat, lng=lng
        )
        return [self._normalize_gm(r) for r in results]

    async def search_by_bounding_box(
        self,
        query: str,
        north: float, south: float, east: float, west: float,
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        center_lat = (north + south) / 2
        center_lng = (east + west) / 2
        from worker.scrapers.google_maps import google_maps_scraper
        results = await google_maps_scraper.search(
            query=query, location=f"{center_lat},{center_lng}",
            max_results=max_results, min_rating=min_rating, min_reviews=min_reviews
        )
        return [self._normalize_gm(r) for r in results]

    async def search_categories(
        self,
        category: str,
        location: str = "",
        max_results: int = 50,
        **kwargs
    ) -> List[NormalizedLead]:
        return await self.search(query=category, location=location, max_results=max_results)

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

    async def health_check(self) -> bool:
        return True
