"""Calendly provider - meeting scheduling integration."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

CALENDLY_API_KEY = os.getenv("CALENDLY_API_KEY", "")
CALENDLY_BASE = "https://api.calendly.com"


class CalendlyProvider(BaseProvider):
    name = "Calendly"
    slug = "calendly"
    description = "Calendly - meeting scheduling and booking integration"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 200
    requests_per_day = 2000
    pricing_tier = "freemium"
    pricing_per_request = 0.0

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or CALENDLY_API_KEY

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
        return []

    async def get_scheduling_link(self, event_type_uri: str) -> str:
        """Get a scheduling link for an event type."""
        if not self.api_key:
            return ""

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{CALENDLY_BASE}/event_types/{event_type_uri}",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                data = response.json()
                return data.get("resource", {}).get("scheduling_url", "")
            except Exception as e:
                logger.error(f"Calendly get link failed: {e}")
                return ""

    async def list_event_types(self) -> List[Dict]:
        """List all event types."""
        if not self.api_key:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{CALENDLY_BASE}/event_types",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                return response.json().get("collection", [])
            except Exception as e:
                logger.error(f"Calendly list events failed: {e}")
                return []

    async def create_scheduling_link_for_lead(self, lead: NormalizedLead) -> Dict:
        """Create a personalized scheduling link for a lead."""
        event_types = await self.list_event_types()
        if event_types:
            link = await self.get_scheduling_link(event_types[0].get("uri", ""))
            return {
                "lead_name": lead.name,
                "lead_email": lead.email,
                "scheduling_link": link,
                "message": f"Book a meeting with {lead.name}",
            }
        return {"error": "No event types found"}

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{CALENDLY_BASE}/users/me",
                    headers={"Authorization": f"Bearer {key}"}
                )
                return resp.status_code == 200
            except Exception:
                return False
