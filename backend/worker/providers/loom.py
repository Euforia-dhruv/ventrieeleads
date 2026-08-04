"""Loom AI provider - video messaging for outreach."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

LOOM_API_KEY = os.getenv("LOOM_API_KEY", "")
LOOM_BASE = "https://api.loom.com/v1"


class LoomProvider(BaseProvider):
    name = "Loom AI"
    slug = "loom"
    description = "Loom - AI-powered video messaging for sales outreach"
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
        self.api_key = (config or {}).get("api_key") or LOOM_API_KEY

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

    async def create_video_message(
        self,
        lead: NormalizedLead,
        title: str = "",
        message: str = "",
    ) -> Dict:
        """Create a personalized video message link for a lead."""
        if not self.api_key:
            return {"error": "API key not set"}

        video_title = title or f"Personalized video for {lead.name}"
        video_message = message or f"Hi {lead.name.split()[0] if lead.name else 'there'}, I wanted to show you..."

        return {
            "lead_name": lead.name,
            "lead_email": lead.email,
            "video_title": video_title,
            "video_message": video_message,
            "recording_url": "https://www.loom.com/recording/new",
            "ai_script_suggestion": self._generate_script(lead),
        }

    def _generate_script(self, lead: NormalizedLead) -> str:
        """Generate an AI script suggestion for the video."""
        name = lead.name.split()[0] if lead.name else "there"
        industry = lead.industry or "your industry"
        return (
            f"Hi {name}, I noticed your company in the {industry} space. "
            f"I wanted to share how we've helped similar businesses grow. "
            f"Could we schedule a quick 15-minute call?"
        )

    async def get_video_analytics(self, video_id: str) -> Dict:
        """Get analytics for a video."""
        if not self.api_key:
            return {}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(
                    f"{LOOM_BASE}/videos/{video_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Loom analytics failed: {e}")
                return {}

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{LOOM_BASE}/users/me",
                    headers={"Authorization": f"Bearer {key}"}
                )
                return resp.status_code == 200
            except Exception:
                return False
