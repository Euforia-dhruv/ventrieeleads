"""Outscraper provider - Google Maps + business data API."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

OUTSCRAPER_API_KEY = os.getenv("OUTSCRAPER_API_KEY", "")
OUTSCRAPER_BASE = "https://api.app.outscraper.com"


class OutscraperProvider(BaseProvider):
    name = "Outscraper"
    slug = "outscraper"
    description = "Outscraper - Google Maps & business data enrichment API"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 200
    requests_per_day = 2000
    pricing_tier = "freemium"
    pricing_per_request = 0.005

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or OUTSCRAPER_API_KEY

    async def initialize(self) -> bool:
        if not self.api_key:
            logger.warning("Outscraper API key not set")
            self._is_initialized = True
            return True
        self._is_initialized = True
        logger.info("Outscraper provider initialized")
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
        if not self.api_key:
            logger.error("Outscraper API key not configured")
            return []

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                search_query = f"{query} {location}".strip()
                response = await client.get(
                    f"{OUTSCRAPER_BASE}/maps/search-v3/async/{search_query}",
                    headers={"X-API-KEY": self.api_key},
                    params={"limit": max_results, "async": "true"}
                )
                response.raise_for_status()
                data = response.json()

                task_id = data.get("id")
                if not task_id:
                    return []

                import asyncio
                await asyncio.sleep(5)

                for _ in range(12):
                    status_resp = await client.get(
                        f"{OUTSCRAPER_BASE}/maps/search-v3/result/{task_id}",
                        headers={"X-API-KEY": self.api_key}
                    )
                    status_data = status_resp.json()
                    if status_data.get("status") == "completed":
                        results = status_data.get("results", [[]])[0]
                        return self._parse_results(results, min_rating, min_reviews)
                    await asyncio.sleep(5)

                return []
            except Exception as e:
                self._track_error(str(e))
                logger.error(f"Outscraper search failed: {e}")
                return []

    def _parse_results(self, results: List[Dict], min_rating: float, min_reviews: int) -> List[NormalizedLead]:
        leads = []
        for item in results:
            try:
                rating = float(item.get("rating", 0) or 0)
                reviews = int(item.get("reviews", 0) or 0)
                if min_rating > 0 and rating < min_rating:
                    continue
                if min_reviews > 0 and reviews < min_reviews:
                    continue

                leads.append(NormalizedLead(
                    name=item.get("name", ""),
                    source="outscraper",
                    website=item.get("site", ""),
                    phone=item.get("phone", ""),
                    email=item.get("email", ""),
                    address=item.get("full_address", ""),
                    city=item.get("city", ""),
                    country=item.get("country", ""),
                    industry=item.get("category", ""),
                    rating=rating,
                    review_count=reviews,
                    description=item.get("description", ""),
                    logo_url=item.get("logo", ""),
                    latitude=float(item.get("latitude", 0) or 0),
                    longitude=float(item.get("longitude", 0) or 0),
                    google_maps_url=item.get("google_maps_url", ""),
                    opening_hours=item.get("working_hours", {}),
                    social_links={
                        k: v for k, v in {
                            "facebook": item.get("facebook"),
                            "instagram": item.get("instagram"),
                            "linkedin": item.get("linkedin"),
                            "twitter": item.get("twitter"),
                        }.items() if v
                    },
                    raw_data=item,
                ))
            except Exception as e:
                logger.debug(f"Failed to parse Outscraper result: {e}")
        return leads

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{OUTSCRAPER_BASE}/maps/search-v3/async/dubai+restaurants",
                    headers={"X-API-KEY": key},
                    params={"limit": 1}
                )
                return resp.status_code in (200, 202)
            except Exception:
                return False
