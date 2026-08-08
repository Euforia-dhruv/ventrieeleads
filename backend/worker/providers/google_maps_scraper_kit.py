"""Google Maps Scraper Kit provider — primary Google Maps business discovery."""
import asyncio
import logging
import re
from typing import List, Optional, Dict
from urllib.parse import quote_plus
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class GoogleMapsScraperKitProvider(BaseProvider):
    name = "Google Maps Scraper Kit"
    slug = "google_maps_scraper_kit"
    description = "Google Maps Scraper Kit — primary business discovery via browser automation with Lightpanda/Playwright"
    requires_browser = True
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 100
    requests_per_day = 1000
    pricing_tier = "free"
    pricing_per_request = 0.0
    supports_map_search = True
    supports_coordinates = True
    supports_bounding_box = True
    supports_nearby = True
    supports_categories = True

    BASE_URL = "https://www.google.com/maps/search/"
    TIMEOUT = 30000

    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        search_query = f"{query} {location}".strip() if location else query
        url = f"{self.BASE_URL}{quote_plus(search_query)}"
        return await self._scrape_google_maps(url, max_results, min_rating, min_reviews)

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
        url = f"https://www.google.com/maps/search/{quote_plus(query)}/@{lat},{lng},14z"
        return await self._scrape_google_maps(url, max_results, min_rating, min_reviews)

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
        url = f"https://www.google.com/maps/search/{quote_plus(query)}/@{center_lat},{center_lng},12z"
        return await self._scrape_google_maps(url, max_results, min_rating, min_reviews)

    async def search_categories(
        self,
        category: str,
        location: str = "",
        max_results: int = 50,
        **kwargs
    ) -> List[NormalizedLead]:
        return await self.search(query=category, location=location, max_results=max_results)

    async def _scrape_google_maps(
        self,
        url: str,
        max_results: int,
        min_rating: float,
        min_reviews: float
    ) -> List[NormalizedLead]:
        """Scrape Google Maps using the browser engine (Lightpanda first, Playwright fallback)."""
        try:
            from worker.scrapers.google_maps import google_maps_scraper
            results = await google_maps_scraper.search(
                query="", location="", max_results=max_results,
                min_rating=min_rating, min_reviews=min_reviews
            )
            return [self._normalize_gm(r) for r in results]
        except Exception as e:
            logger.error(f"Google Maps Scraper Kit failed: {e}")
            return []

    def _normalize_gm(self, r) -> NormalizedLead:
        return NormalizedLead(
            name=r.name,
            source="google_maps_scraper_kit",
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
            raw_data={"name": r.name, "category": r.category, "address": r.address}
        )

    async def health_check(self) -> bool:
        return True
