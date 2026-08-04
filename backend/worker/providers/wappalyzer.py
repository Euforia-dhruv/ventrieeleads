"""Wappalyzer provider - technology detection and company profiling."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

WAPPALYZER_API_KEY = os.getenv("WAPPALYZER_API_KEY", "")
WAPPALYZER_BASE = "https://api.wappalyzer.com/v2"


class WappalyzerProvider(BaseProvider):
    name = "Wappalyzer"
    slug = "wappalyzer"
    description = "Wappalyzer - technology profiling and lead enrichment"
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
        self.api_key = (config or {}).get("api_key") or WAPPALYZER_API_KEY

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

        domains = kwargs.get("domains", [query])
        if isinstance(domains, str):
            domains = [domains]

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{WAPPALYZER_BASE}/lookup",
                    params={
                        "urls[]": domains[:10],
                        "recursive": "false",
                    },
                    headers={"X-Api-Key": self.api_key}
                )
                response.raise_for_status()
                data = response.json()

                leads = []
                techs_by_domain = {}
                for tech in data.get("technologies", []):
                    for match in tech.get("matches", []):
                        domain = match.get("url", "")
                        if domain not in techs_by_domain:
                            techs_by_domain[domain] = []
                        techs_by_domain[domain].append(tech.get("name", ""))

                for domain, techs in techs_by_domain.items():
                    leads.append(NormalizedLead(
                        name=domain,
                        source="wappalyzer",
                        website=f"https://{domain}" if not domain.startswith("http") else domain,
                        metadata={
                            "technologies": techs,
                            "tech_categories": list(set(t.split("/")[0] for t in techs if "/" in t)),
                            "profile_url": f"https://www.wappalyzer.com/lookup/{domain}",
                        },
                        raw_data={"domain": domain, "technologies": techs},
                    ))

                return leads[:max_results]
            except Exception as e:
                self._track_error(str(e))
                logger.error(f"Wappalyzer search failed: {e}")
                return []

    async def get_tech_profile(self, url: str) -> Dict:
        """Get detailed tech profile for a URL."""
        if not self.api_key:
            return {}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{WAPPALYZER_BASE}/lookup",
                    params={"urls[]": url, "recursive": "false"},
                    headers={"X-Api-Key": self.api_key}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Wappalyzer tech profile failed: {e}")
                return {}

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{WAPPALYZER_BASE}/lookup",
                    params={"urls[]": "google.com"},
                    headers={"X-Api-Key": key}
                )
                return resp.status_code == 200
            except Exception:
                return False
