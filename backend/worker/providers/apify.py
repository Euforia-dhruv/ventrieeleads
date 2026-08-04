"""Apify provider - scraping marketplace with pre-built actors."""
import logging
import os
import asyncio
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")
APIFY_BASE = "https://api.apify.com/v2"

# Popular actors for lead gen
ACTORS = {
    "google-maps": "compass/crawler-google-places",
    "website-scraper": "apify/web-scraper",
    "linkedin": "anchor/linkedin-scraper",
    "instagram": "apify/instagram-scraper",
}


class ApifyProvider(BaseProvider):
    name = "Apify"
    slug = "apify"
    description = "Apify - web scraping marketplace with 2000+ pre-built actors"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 5
    requests_per_hour = 100
    requests_per_day = 1000
    pricing_tier = "freemium"
    pricing_per_request = 0.01

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_token = (config or {}).get("api_token") or APIFY_API_TOKEN
        self.default_actor = (config or {}).get("default_actor", "compass/crawler-google-places")

    async def initialize(self) -> bool:
        if not self.api_token:
            logger.warning("Apify API token not set")
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
        if not self.api_token:
            return []

        actor_id = kwargs.get("actor_id", self.default_actor)

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                input_data = {
                    "searchStringsArray": [f"{query} {location}".strip()],
                    "maxCrawledPlaces": max_results,
                    "language": "en",
                }

                if min_rating > 0:
                    input_data["minRating"] = min_rating

                response = await client.post(
                    f"{APIFY_BASE}/acts/{actor_id}/runs",
                    params={"token": self.api_token},
                    json=input_data
                )
                response.raise_for_status()
                run_data = response.json().get("data", {})
                run_id = run_data.get("id")

                if not run_id:
                    return []

                await asyncio.sleep(10)

                for _ in range(30):
                    status_resp = await client.get(
                        f"{APIFY_BASE}/actor-runs/{run_id}",
                        params={"token": self.api_token}
                    )
                    status = status_resp.json().get("data", {}).get("status")
                    if status == "SUCCEEDED":
                        break
                    elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
                        logger.error(f"Apify run {run_id} failed: {status}")
                        return []
                    await asyncio.sleep(5)

                dataset_id = status_resp.json().get("data", {}).get("defaultDatasetId")
                if not dataset_id:
                    return []

                items_resp = await client.get(
                    f"{APIFY_BASE}/datasets/{dataset_id}/items",
                    params={"token": self.api_token, "format": "json"}
                )
                items = items_resp.json()

                return self._parse_results(items, min_rating, min_reviews)

            except Exception as e:
                self._track_error(str(e))
                logger.error(f"Apify search failed: {e}")
                return []

    def _parse_results(self, items: List[Dict], min_rating: float, min_reviews: int) -> List[NormalizedLead]:
        leads = []
        for item in items:
            try:
                rating = float(item.get("totalScore", item.get("rating", 0)) or 0)
                reviews = int(item.get("reviewsCount", item.get("reviews", 0)) or 0)
                if min_rating > 0 and rating < min_rating:
                    continue
                if min_reviews > 0 and reviews < min_reviews:
                    continue

                leads.append(NormalizedLead(
                    name=item.get("title", item.get("name", "")),
                    source="apify",
                    website=item.get("url", item.get("website", "")),
                    phone=item.get("phone", item.get("phoneUnformatted", "")),
                    email=item.get("email", ""),
                    address=item.get("address", item.get("street", "")),
                    city=item.get("city", ""),
                    country=item.get("country", ""),
                    industry=item.get("categoryName", item.get("category", "")),
                    rating=rating,
                    review_count=reviews,
                    description=item.get("description", ""),
                    logo_url=item.get("logo", item.get("image", "")),
                    latitude=float(item.get("latitude", 0) or 0),
                    longitude=float(item.get("longitude", 0) or 0),
                    google_maps_url=item.get("placeUrl", item.get("googleUrl", "")),
                    opening_hours=item.get("openingHours", {}),
                    social_links={},
                    raw_data=item,
                ))
            except Exception as e:
                logger.debug(f"Failed to parse Apify result: {e}")
        return leads

    async def run_actor(self, actor_id: str, input_data: Dict) -> Optional[str]:
        """Run any Apify actor and return run ID."""
        if not self.api_token:
            return None

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                response = await client.post(
                    f"{APIFY_BASE}/acts/{actor_id}/runs",
                    params={"token": self.api_token},
                    json=input_data
                )
                response.raise_for_status()
                return response.json().get("data", {}).get("id")
            except Exception as e:
                logger.error(f"Apify actor run failed: {e}")
                return None

    async def validate(self, config: Dict = None) -> bool:
        token = (config or {}).get("api_token") or self.api_token
        if not token:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{APIFY_BASE}/acts",
                    params={"token": token, "limit": 1}
                )
                return resp.status_code == 200
            except Exception:
                return False
