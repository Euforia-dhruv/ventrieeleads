"""PhantomBuster provider — optional premium automation API."""
import logging
import os
import asyncio
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

PHANTOMBUSTER_API_KEY = os.getenv("PHANTOMBUSTER_API_KEY", "")
PHANTOMBUSTER_BASE = "https://api.phantombuster.com/v2"


class PhantomBusterProvider(BaseProvider):
    name = "PhantomBuster"
    slug = "phantombuster"
    description = "PhantomBuster — premium lead generation and sales automation API"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 5
    requests_per_hour = 100
    requests_per_day = 1000
    pricing_tier = "paid"
    pricing_per_request = 0.02

    PHANTOMS = {
        "google-maps": "Google Maps Scraper",
        "linkedin-search": "LinkedIn Company Search",
        "website-contact": "Website Contact Scraper",
    }

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or PHANTOMBUSTER_API_KEY

    async def initialize(self) -> bool:
        if not self.api_key:
            logger.warning("PhantomBuster API key not set — provider disabled")
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
        if not self.api_key:
            return []

        phantom_id = kwargs.get("phantom_id", "")
        input_data = kwargs.get("input", {})

        if not phantom_id:
            return await self._google_maps_search(query, location, max_results, min_rating)

        return await self._run_phantom(phantom_id, input_data, max_results)

    async def _google_maps_search(
        self,
        query: str,
        location: str,
        max_results: int,
        min_rating: float
    ) -> List[NormalizedLead]:
        """Run Google Maps phantom."""
        headers = {"X-PhantomBuster-API-Key": self.api_key}
        search_input = {
            "search": f"{query} {location}".strip(),
            "resultsCount": str(max_results),
        }
        if min_rating > 0:
            search_input["minimumRating"] = str(min_rating)

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                resp = await client.post(
                    f"{PHANTOMBUSTER_BASE}/phantoms/launch",
                    headers=headers,
                    json={"phantomId": "1775247568724984", "argument": search_input}
                )
                resp.raise_for_status()
                phantom_output_id = resp.json().get("container", {}).get("id")

                if not phantom_output_id:
                    return []

                await asyncio.sleep(15)

                for _ in range(24):
                    status_resp = await client.get(
                        f"{PHANTOMBUSTER_BASE}/containers/{phantom_output_id}",
                        headers=headers
                    )
                    container = status_resp.json()
                    status = container.get("status")
                    if status == "finished":
                        break
                    elif status in ("error", "crashed"):
                        logger.error(f"PhantomBuster phantom failed: {status}")
                        return []
                    await asyncio.sleep(5)

                output_resp = await client.get(
                    f"{PHANTOMBUSTER_BASE}/containers/{phantom_output_id}/output",
                    headers=headers
                )
                output = output_resp.json().get("output", [])
                return self._parse_output(output)

            except Exception as e:
                self._track_error(str(e))
                logger.error(f"PhantomBuster search failed: {e}")
                return []

    async def _run_phantom(self, phantom_id: str, input_data: Dict, max_results: int) -> List[NormalizedLead]:
        """Run a custom phantom."""
        headers = {"X-PhantomBuster-API-Key": self.api_key}

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                resp = await client.post(
                    f"{PHANTOMBUSTER_BASE}/phantoms/launch",
                    headers=headers,
                    json={"phantomId": phantom_id, "argument": input_data}
                )
                resp.raise_for_status()
                container_id = resp.json().get("container", {}).get("id")

                if not container_id:
                    return []

                await asyncio.sleep(10)

                for _ in range(24):
                    status_resp = await client.get(
                        f"{PHANTOMBUSTER_BASE}/containers/{container_id}",
                        headers=headers
                    )
                    status = status_resp.json().get("status")
                    if status == "finished":
                        break
                    elif status in ("error", "crashed"):
                        return []
                    await asyncio.sleep(5)

                output_resp = await client.get(
                    f"{PHANTOMBUSTER_BASE}/containers/{container_id}/output",
                    headers=headers
                )
                output = output_resp.json().get("output", [])
                return self._parse_output(output)[:max_results]

            except Exception as e:
                self._track_error(str(e))
                logger.error(f"PhantomBuster run failed: {e}")
                return []

    def _parse_output(self, output: List[Dict]) -> List[NormalizedLead]:
        """Parse PhantomBuster output into NormalizedLead."""
        leads = []
        for item in output:
            try:
                leads.append(NormalizedLead(
                    name=item.get("name", item.get("title", "")),
                    source="phantombuster",
                    website=item.get("website", item.get("url", "")),
                    phone=item.get("phone", ""),
                    email=item.get("email", ""),
                    address=item.get("address", item.get("location", "")),
                    city=item.get("city", ""),
                    country=item.get("country", ""),
                    industry=item.get("category", item.get("industry", "")),
                    rating=float(item.get("rating", 0) or 0),
                    review_count=int(item.get("reviews", item.get("reviewCount", 0)) or 0),
                    description=item.get("description", ""),
                    logo_url=item.get("logo", item.get("image", "")),
                    latitude=float(item.get("latitude", 0) or 0),
                    longitude=float(item.get("longitude", 0) or 0),
                    google_maps_url=item.get("googleMapsUrl", item.get("placeUrl", "")),
                    raw_data=item,
                ))
            except Exception as e:
                logger.debug(f"PhantomBuster parse error: {e}")

        return leads

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{PHANTOMBUSTER_BASE}/user",
                    headers={"X-PhantomBuster-API-Key": key}
                )
                return resp.status_code == 200
            except Exception:
                return False
