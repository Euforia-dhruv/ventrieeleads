"""BuiltWith provider - tech stack detection and company profiling."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY", "")
BUILTWITH_BASE = "https://api.builtwith.com/free1"


class BuiltWithProvider(BaseProvider):
    name = "BuiltWith"
    slug = "builtwith"
    description = "BuiltWith - website technology profiling and lead intelligence"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 5
    requests_per_hour = 50
    requests_per_day = 500
    pricing_tier = "freemium"
    pricing_per_request = 0.02

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or BUILTWITH_API_KEY

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
        if not self.api_key:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{BUILTWITH_BASE}/api.json",
                    params={"KEY": self.api_key, "LOOKUP": query}
                )
                response.raise_for_status()
                data = response.json()

                results = data.get("Results", {}).get("Result", [])
                if isinstance(results, dict):
                    results = [results]

                leads = []
                for result in results[:max_results]:
                    techs = []
                    meta = result.get("Meta", {})
                    tech_info = result.get("Technologies", [])
                    if isinstance(tech_info, list):
                        techs = [t.get("Name", "") for t in tech_info[:20]]

                    leads.append(NormalizedLead(
                        name=meta.get("Name", query),
                        source="builtwith",
                        website=meta.get("Url", f"https://{query}" if not query.startswith("http") else query),
                        industry=meta.get("Vertical", ""),
                        country=meta.get("Country", ""),
                        metadata={
                            "technologies": techs,
                            "tech_categories": list(set(t.split("/")[0] for t in techs if "/" in t)),
                            "profile_url": f"https://builtwith.com/{query}",
                        },
                        raw_data=result,
                    ))
                return leads
            except Exception as e:
                self._track_error(str(e))
                logger.error(f"BuiltWith search failed: {e}")
                return []

    async def get_tech_profile(self, domain: str) -> Dict:
        """Get detailed tech profile for a domain."""
        if not self.api_key:
            return {}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{BUILTWITH_BASE}/api.json",
                    params={"KEY": self.api_key, "LOOKUP": domain}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"BuiltWith tech profile failed: {e}")
                return {}

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{BUILTWITH_BASE}/api.json",
                    params={"KEY": key, "LOOKUP": "google.com"}
                )
                return resp.status_code == 200
            except Exception:
                return False
