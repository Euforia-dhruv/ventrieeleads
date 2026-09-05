"""Social Media Scraper provider — wraps Scout scrapers for multi-platform lead generation."""
import logging
import asyncio
from typing import List, Optional, Dict
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)

PLATFORM_SCRAPERS = {
    'instagram': 'worker.scout.scrapers.instagram.scrape_profile_no_login',
    'tiktok': 'worker.scout.scrapers.tiktok.scrape_tiktok_profile',
    'github': 'worker.scout.scrapers.github.scrape_profile',
    'youtube': 'worker.scout.scrapers.youtube.scrape_channel',
    'twitch': 'worker.scout.scrapers.twitch.scrape_profile',
    'linkedin': 'worker.scout.scrapers.linkedin.scrape_linkedin_profile',
    'pinterest': 'worker.scout.scrapers.pinterest.scrape_profile',
    'linktree': 'worker.scout.scrapers.linktree.scrape_linktree',
}


class SocialMediaProvider(BaseProvider):
    name = "Social Media Scraper"
    slug = "social_media"
    description = "Scrape profiles from Instagram, TikTok, LinkedIn, GitHub, YouTube, Twitch, Pinterest, and Linktree"
    requires_browser = False
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 100
    requests_per_day = 1000
    pricing_tier = "free"
    pricing_per_request = 0.0

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
        platform = kwargs.get("platform", "instagram")

        if not usernames:
            return []

        if platform not in PLATFORM_SCRAPERS:
            logger.warning(f"Unsupported platform: {platform}")
            return []

        scraper_path = PLATFORM_SCRAPERS[platform]
        module_path, func_name = scraper_path.rsplit('.', 1)

        def _import_func():
            import importlib
            mod = importlib.import_module(module_path)
            return getattr(mod, func_name)

        scraper_func = await asyncio.to_thread(_import_func)

        results = []
        for username in usernames[:max_results]:
            try:
                profile = await asyncio.to_thread(scraper_func, username)
                if profile:
                    lead = self._normalize(profile, platform)
                    results.append(lead)
            except Exception as e:
                logger.debug(f"Scrape failed for @{username} on {platform}: {e}")

            await asyncio.sleep(1.5)

        return results

    async def enrich(self, lead: NormalizedLead) -> NormalizedLead:
        if lead.website:
            try:
                from worker.scout.enrichment import LeadEnricher
                enricher = LeadEnricher()
                enriched = await asyncio.to_thread(
                    enricher.enrich_lead,
                    {
                        'bio': lead.description,
                        'website': lead.website,
                        'full_name': lead.name,
                        'follower_count': lead.metadata.get('follower_count', 0),
                    }
                )
                if enriched.get('email') and not lead.email:
                    lead.email = enriched['email']
                if enriched.get('phone') and not lead.phone:
                    lead.phone = enriched['phone']
                if enriched.get('lead_score'):
                    lead.metadata['lead_score'] = enriched['lead_score']
            except Exception as e:
                logger.debug(f"Social enrichment failed: {e}")
        return lead

    def _normalize(self, profile: Dict, platform: str) -> NormalizedLead:
        social_links = {}
        for platform_name in ['instagram', 'twitter', 'tiktok', 'youtube', 'github', 'linkedin', 'facebook']:
            if profile.get(platform_name):
                social_links[platform_name] = profile[platform_name]
        if profile.get('socials'):
            social_links.update(profile['socials'])

        return NormalizedLead(
            name=profile.get('full_name') or profile.get('username', ''),
            source=f"scout_{platform}",
            website=profile.get('website', ''),
            phone=profile.get('phone', ''),
            email=profile.get('email', ''),
            description=profile.get('bio', ''),
            social_links=social_links,
            metadata={
                'platform': platform,
                'username': profile.get('username', ''),
                'follower_count': profile.get('follower_count', 0),
                'profile_url': profile.get('profile_url', ''),
                'is_verified': profile.get('is_verified', False),
            },
            raw_data=profile,
        )

    async def health_check(self) -> bool:
        return True
