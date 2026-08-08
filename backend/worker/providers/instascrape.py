"""Instascrape provider — Instagram business profile enrichment."""
import logging
import re
import os
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class InstascrapeProvider(BaseProvider):
    name = "Instascrape"
    slug = "instascrape"
    description = "Instascrape — Instagram business profile discovery and enrichment"
    requires_browser = False
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 5
    requests_per_hour = 50
    requests_per_day = 500
    pricing_tier = "free"
    pricing_per_request = 0.0

    GRAPHQL_URL = "https://www.instagram.com/graphql/query/"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "X-IG-App-ID": "936619743392459",
    }

    def __init__(self, config: Dict = None):
        super().__init__(config)

    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        usernames = kwargs.get("usernames", [])
        if not usernames and query:
            usernames = [query]

        leads = []
        async with httpx.AsyncClient(timeout=15, headers=self.HEADERS, follow_redirects=True) as client:
            for username in usernames[:max_results]:
                try:
                    lead = await self._fetch_profile(client, username.strip("@"))
                    if lead:
                        leads.append(lead)
                except Exception as e:
                    logger.debug(f"Instascrape failed for {username}: {e}")

        return leads

    async def _fetch_profile(self, client: httpx.AsyncClient, username: str) -> Optional[NormalizedLead]:
        """Fetch an Instagram profile via web API."""
        try:
            resp = await client.get(f"https://www.instagram.com/{username}/")
            if resp.status_code != 200:
                return None

            html = resp.text

            shared_data = None
            match = re.search(r'window\._sharedData\s*=\s*({.*?});', html)
            if match:
                import json
                try:
                    shared_data = json.loads(match.group(1))
                except Exception:
                    pass

            require_match = re.search(r'window\.__additionalDataLoaded\s*\([^,]+,\s*({.*?})\);', html)
            if require_match and not shared_data:
                import json
                try:
                    shared_data = json.loads(require_match.group(1))
                except Exception:
                    pass

            if not shared_data:
                user_data_match = re.search(r'"user":\s*({.*?"username".*?})', html)
                if user_data_match:
                    import json
                    try:
                        shared_data = {"user": json.loads(user_data_match.group(1))}
                    except Exception:
                        pass

            if not shared_data:
                return self._extract_from_meta(username, html)

            user = shared_data.get("user", shared_data.get("data", {}).get("user", {}))
            if not user:
                return None

            website = user.get("external_url", "")
            bio = user.get("biography", "")
            full_name = user.get("full_name", username)
            is_business = user.get("is_business_account", False)
            follower_count = user.get("follower_count", 0)
            following_count = user.get("following_count", 0)
            media_count = user.get("media", {}).get("count", 0) if isinstance(user.get("media"), dict) else 0
            profile_pic = user.get("profile_pic_url_hd", user.get("profile_pic_url", ""))

            social_links = {}
            if website:
                social_links["website"] = website
            social_links["instagram"] = f"https://www.instagram.com/{username}/"

            return NormalizedLead(
                name=full_name or username,
                source="instascrape",
                website=website,
                description=bio[:500],
                logo_url=profile_pic,
                social_links=social_links,
                metadata={
                    "instagram_url": f"https://www.instagram.com/{username}/",
                    "username": username,
                    "is_business": is_business,
                    "follower_count": follower_count,
                    "following_count": following_count,
                    "media_count": media_count,
                },
                raw_data=user,
            )
        except Exception as e:
            logger.debug(f"Instascrape profile fetch failed for {username}: {e}")
            return None

    def _extract_from_meta(self, username: str, html: str) -> Optional[NormalizedLead]:
        """Extract basic info from meta tags when JSON data is unavailable."""
        meta_match = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', html)
        description = meta_match.group(1) if meta_match else ""

        title_match = re.search(r'<title>([^<]+)</title>', html)
        title = title_match.group(1) if title_match else username

        pic_match = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
        profile_pic = pic_match.group(1) if pic_match else ""

        follower_match = re.search(r'([\d,]+[KMB]?) Followers', description)
        followers = follower_match.group(1) if follower_match else "0"

        return NormalizedLead(
            name=title.split("•")[0].strip() if "•" in title else title,
            source="instascrape",
            description=description[:500],
            logo_url=profile_pic,
            social_links={"instagram": f"https://www.instagram.com/{username}/"},
            metadata={
                "instagram_url": f"https://www.instagram.com/{username}/",
                "username": username,
                "follower_text": followers,
            },
            raw_data={"username": username, "meta_description": description},
        )

    async def enrich(self, lead: NormalizedLead) -> NormalizedLead:
        """Enrich a lead with Instagram data if username is available."""
        username = lead.metadata.get("username") or lead.social_links.get("instagram", "")
        if not username:
            return lead

        username = username.rstrip("/").split("/")[-1]
        if not username or username.startswith("http"):
            return lead

        async with httpx.AsyncClient(timeout=15, headers=self.HEADERS) as client:
            enriched = await self._fetch_profile(client, username)
            if enriched:
                if not lead.description and enriched.description:
                    lead.description = enriched.description
                if not lead.logo_url and enriched.logo_url:
                    lead.logo_url = enriched.logo_url
                existing = lead.metadata or {}
                existing.update(enriched.metadata or {})
                lead.metadata = existing

        return lead

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10, headers=self.HEADERS) as client:
                resp = await client.get("https://www.instagram.com/instagram/")
                return resp.status_code == 200
        except Exception:
            return False
