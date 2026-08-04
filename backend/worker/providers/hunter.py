"""Hunter.io provider - email finder and verifier."""
import logging
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

HUNTER_API_KEY = os.getenv("HUNTER_API_KEY", "")
HUNTER_BASE = "https://api.hunter.io/v2"


class HunterProvider(BaseProvider):
    name = "Hunter.io"
    slug = "hunter"
    description = "Hunter.io - email finder and verifier for B2B"
    requires_browser = False
    requires_api_key = True
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 300
    requests_per_day = 3000
    pricing_tier = "freemium"
    pricing_per_request = 0.005

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.api_key = (config or {}).get("api_key") or HUNTER_API_KEY

    async def initialize(self) -> bool:
        if not self.api_key:
            logger.warning("Hunter API key not set")
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
                    f"{HUNTER_BASE}/domain-search",
                    params={
                        "api_key": self.api_key,
                        "domain": query,
                        "limit": min(max_results, 25),
                        "type": "personal",
                    }
                )
                response.raise_for_status()
                data = response.json()

                emails = data.get("data", {}).get("emails", [])
                organization = data.get("data", {}).get("organization", "")

                leads = []
                for email_data in emails:
                    full_name = f"{email_data.get('first_name', '')} {email_data.get('last_name', '')}".strip()
                    leads.append(NormalizedLead(
                        name=full_name or email_data.get("value", ""),
                        source="hunter",
                        email=email_data.get("value", ""),
                        phone="",
                        website=f"https://{query}" if not query.startswith("http") else query,
                        industry="",
                        metadata={
                            "confidence": email_data.get("confidence", 0),
                            "position": email_data.get("position", ""),
                            "linkedin": email_data.get("linkedin", ""),
                            "twitter": email_data.get("twitter", ""),
                            "company": organization,
                        },
                        raw_data=email_data,
                    ))

                return leads
            except Exception as e:
                self._track_error(str(e))
                logger.error(f"Hunter search failed: {e}")
                return []

    async def find_emails(self, domain: str, first_name: str = "", last_name: str = "") -> List[Dict]:
        """Find email addresses for a domain."""
        if not self.api_key:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                params = {"api_key": self.api_key, "domain": domain}
                if first_name:
                    params["first_name"] = first_name
                if last_name:
                    params["last_name"] = last_name

                response = await client.get(f"{HUNTER_BASE}/email-finder", params=params)
                response.raise_for_status()
                return response.json().get("data", {})
            except Exception as e:
                logger.error(f"Hunter email finder failed: {e}")
                return {}

    async def verify_email(self, email: str) -> Dict:
        """Verify an email address."""
        if not self.api_key:
            return {}

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                response = await client.get(
                    f"{HUNTER_BASE}/email-verifier",
                    params={"api_key": self.api_key, "email": email}
                )
                response.raise_for_status()
                return response.json().get("data", {})
            except Exception as e:
                logger.error(f"Hunter email verify failed: {e}")
                return {}

    async def validate(self, config: Dict = None) -> bool:
        key = (config or {}).get("api_key") or self.api_key
        if not key:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(
                    f"{HUNTER_BASE}/account",
                    params={"api_key": key}
                )
                return resp.status_code == 200
            except Exception:
                return False
