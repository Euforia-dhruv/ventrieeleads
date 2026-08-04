"""Apollo.io provider - B2B contact database."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

APOLLO_API_KEY = os.getenv("APOLLO_API_KEY", "")
APOLLO_BASE = "https://api.apollo.io/api/v1"


class ApolloProvider(BaseProvider):
    name = "Apollo.io"
    slug = "apollo"
    description = "Apollo.io - B2B contact and company database"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 200
    requests_per_day = 2000
    pricing_tier = "freemium"
    pricing_per_request = 0.01

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or APOLLO_API_KEY

    async def initialize(self) -> bool:
        if not self.api_key:
            logger.warning("Apollo API key not set")
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
                payload = {
                    "api_key": self.api_key,
                    "q_keywords": query,
                    "per_page": min(max_results, 25),
                }
                if location:
                    payload["organization_locations"] = [location]

                response = await client.post(
                    f"{APOLLO_BASE}/mixed_people/search",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()

                people = data.get("people", [])
                leads = []
                for person in people:
                    org = person.get("organization", {}) or {}
                    leads.append(NormalizedLead(
                        name=org.get("name", f"{person.get('first_name', '')} {person.get('last_name', '')}".strip()),
                        source="apollo",
                        website=org.get("website_url", ""),
                        phone=person.get("phone_numbers", [{}])[0].get("sanitized_number", "") if person.get("phone_numbers") else "",
                        email=person.get("email", ""),
                        address=org.get("raw_address", ""),
                        city=person.get("city", "") or org.get("city", ""),
                        country=person.get("country", "") or org.get("country", ""),
                        industry=org.get("industry", ""),
                        description=org.get("description", ""),
                        social_links={
                            "linkedin": person.get("linkedin_url", ""),
                        } if person.get("linkedin_url") else {},
                        metadata={
                            "apollo_id": person.get("id", ""),
                            "title": person.get("title", ""),
                            "company_size": org.get("estimated_num_employees", ""),
                        },
                        raw_data=person,
                    ))
                return leads
            except Exception as e:
                self._track_error(str(e))
                logger.error(f"Apollo search failed: {e}")
                return []

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    f"{APOLLO_BASE}/mixed_people/search",
                    json={"api_key": key, "q_keywords": "test", "per_page": 1}
                )
                return resp.status_code == 200
            except Exception:
                return False
