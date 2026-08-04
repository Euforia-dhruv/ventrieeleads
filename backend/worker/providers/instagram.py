"""Instagram provider - Instagram profile scraping for lead gen."""
import logging
import os
import re
from typing import List, Optional, Dict
import httpx
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class InstagramProvider(BaseProvider):
    name = "Instagram"
    slug = "instagram"
    description = "Instagram - profile and business discovery for lead generation"
    requires_browser = True
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 5
    requests_per_hour = 50
    requests_per_day = 500
    pricing_tier = "free"
    pricing_per_request = 0.0

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self._session = None

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
        hashtag = kwargs.get("hashtag", query.replace(" ", ""))
        return await self._search_by_hashtag(hashtag, max_results)

    async def _search_by_hashtag(self, hashtag: str, max_results: int) -> List[NormalizedLead]:
        """Search Instagram by hashtag."""
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
                )
                page = await context.new_page()

                await page.goto(f"https://www.instagram.com/explore/tags/{hashtag}/", wait_until="networkidle")
                await page.wait_for_timeout(3000)

                profiles = await page.evaluate("""
                    () => {
                        const links = document.querySelectorAll('a[href*="/"]');
                        const profiles = new Set();
                        links.forEach(link => {
                            const href = link.getAttribute('href');
                            if (href && href.match(/^\\/[^/]+\\/$/) && !href.includes('explore') && !href.includes('accounts')) {
                                profiles.add(href.replace(/\//g, ''));
                            }
                        });
                        return Array.from(profiles).slice(0, 50);
                    }
                """)

                leads = []
                for profile in profiles[:max_results]:
                    try:
                        await page.goto(f"https://www.instagram.com/{profile}/", wait_until="networkidle")
                        await page.wait_for_timeout(2000)

                        profile_data = await page.evaluate("""
                            () => {
                                const name = document.querySelector('header section h2')?.textContent || '';
                                const bio = document.querySelector('header section div')?.textContent || '';
                                const website = document.querySelector('header section a[href*="l.instagram"]')?.href || '';
                                const isBusiness = document.querySelector('header section button')?.textContent?.includes('Contact') || false;
                                return { name, bio, website, isBusiness };
                            }
                        """)

                        website = profile_data.get("website", "")
                        if "l.instagram.com" in website:
                            import httpx as httpx_client
                            async with httpx_client.AsyncClient(follow_redirects=True, timeout=5) as client:
                                resp = await client.head(website)
                                website = str(resp.url)

                        leads.append(NormalizedLead(
                            name=profile_data.get("name", profile),
                            source="instagram",
                            website=website,
                            description=profile_data.get("bio", ""),
                            metadata={
                                "instagram_url": f"https://www.instagram.com/{profile}/",
                                "is_business": profile_data.get("isBusiness", False),
                                "username": profile,
                            },
                            raw_data=profile_data,
                        ))
                    except Exception as e:
                        logger.debug(f"Failed to scrape Instagram profile {profile}: {e}")

                await browser.close()
                return leads

        except ImportError:
            logger.warning("Playwright not installed for Instagram scraping")
            return []
        except Exception as e:
            self._track_error(str(e))
            logger.error(f"Instagram search failed: {e}")
            return []

    async def get_profile(self, username: str) -> Optional[NormalizedLead]:
        """Get detailed profile information."""
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
                )
                page = await context.new_page()

                await page.goto(f"https://www.instagram.com/{username}/", wait_until="networkidle")
                await page.wait_for_timeout(3000)

                profile_data = await page.evaluate("""
                    () => {
                        const name = document.querySelector('header section h2')?.textContent || '';
                        const bio = document.querySelector('header section div')?.textContent || '';
                        const website = document.querySelector('header section a[href*="l.instagram"]')?.href || '';
                        const isBusiness = document.querySelector('header section button')?.textContent?.includes('Contact') || false;
                        return { name, bio, website, isBusiness };
                    }
                """)

                await browser.close()

                return NormalizedLead(
                    name=profile_data.get("name", username),
                    source="instagram",
                    description=profile_data.get("bio", ""),
                    metadata={
                        "instagram_url": f"https://www.instagram.com/{username}/",
                        "is_business": profile_data.get("isBusiness", False),
                    },
                    raw_data=profile_data,
                )
        except Exception as e:
            logger.error(f"Instagram profile failed: {e}")
            return None

    async def validate(self, config: Dict = None) -> bool:
        try:
            from playwright.async_api import async_playwright
            return True
        except ImportError:
            return False
