"""Scrapling provider — primary anti-bot web scraper for business discovery and enrichment."""
import logging
import os
import re
from typing import List, Optional, Dict
from urllib.parse import urljoin
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ScraplingProvider(BaseProvider):
    name = "Scrapling"
    slug = "scrapling"
    description = "Scrapling — Python scraper with auto-detection, anti-bot bypass, and structured data extraction"
    requires_browser = True
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 10
    requests_per_hour = 100
    requests_per_day = 1000
    pricing_tier = "free"
    pricing_per_request = 0.0
    supports_map_search = True
    supports_coordinates = True

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self._fetcher = None

    async def initialize(self) -> bool:
        try:
            from scrapling import Fetcher
            self._fetcher = Fetcher(auto_match=False)
            self._is_initialized = True
            logger.info("Scrapling provider initialized")
            return True
        except ImportError:
            logger.warning("Scrapling not installed")
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
        """Search for businesses by scraping directory pages with Scrapling."""
        url = kwargs.get("url")
        if not url:
            return []

        try:
            from scrapling import Fetcher
            fetcher = Fetcher(auto_match=False)
            page = fetcher.get(url, timeout=20, headless=True, stealthy_headers=True)

            if not page:
                return []

            results = []
            # Generic card/listing selectors for common directory sites
            cards = page.css(
                '[class*="card"], [class*="listing"], [class*="result"], '
                '[class*="business"], [class*="company"], article, '
                'div[class*="item"], tr[class*="row"], li[class*="result"]'
            )

            for card in cards[:max_results]:
                try:
                    name_el = card.css_first(
                        'h2, h3, h4, [class*="name"], [class*="title"], '
                        '[class*="company"], a[class*="name"]'
                    )
                    if not name_el:
                        continue

                    name = (name_el.text or "").strip()
                    if not name or len(name) < 2:
                        continue

                    link_el = card.css_first('a[href]')
                    link = link_el.attrib.get("href", "") if link_el else ""

                    phone_el = card.css_first('[class*="phone"], [href^="tel:"]')
                    phone = (phone_el.text or "").strip() if phone_el else ""

                    email_el = card.css_first('[href^="mailto:"]')
                    email = email_el.attrib.get("href", "").replace("mailto:", "") if email_el else ""

                    rating_el = card.css_first('[class*="rating"], [class*="stars"]')
                    rating_text = (rating_el.text or "").strip() if rating_el else ""
                    rating = 0.0
                    if rating_text:
                        nums = re.search(r'[\d.]+', rating_text)
                        if nums:
                            try:
                                rating = float(nums.group())
                            except ValueError:
                                pass

                    industry_el = card.css_first('[class*="category"], [class*="industry"], [class*="type"]')
                    industry = (industry_el.text or "").strip() if industry_el else ""

                    results.append(NormalizedLead(
                        name=name,
                        source="scrapling",
                        website=link,
                        phone=phone,
                        email=email,
                        industry=industry,
                        rating=rating,
                        raw_data={"url": url, "selector": str(card)},
                    ))
                except Exception as e:
                    logger.debug(f"Failed to parse Scrapling card: {e}")

            return results

        except ImportError:
            logger.warning("Scrapling not installed")
            return []
        except Exception as e:
            self._track_error(str(e))
            logger.error(f"Scrapling search failed: {e}")
            return []

    async def search_by_map(
        self,
        query: str,
        lat: float,
        lng: float,
        radius_km: float = 10.0,
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        """Search using coordinates — delegates to Google Maps Scraper Kit."""
        try:
            from worker.providers.google_maps_scraper_kit import GoogleMapsScraperKitProvider
            kit = GoogleMapsScraperKitProvider()
            return await kit.search_by_map(
                query=query, lat=lat, lng=lng, radius_km=radius_km,
                max_results=max_results, min_rating=min_rating,
                min_reviews=min_reviews, **kwargs
            )
        except Exception as e:
            logger.error(f"Scrapling map search fallback failed: {e}")
            return []

    async def scrape_page(self, url: str) -> Dict:
        """Scrape a single page and extract structured data."""
        try:
            from scrapling import Fetcher
            fetcher = Fetcher(auto_match=False)
            page = fetcher.get(url, timeout=15, headless=True, stealthy_headers=True)

            if not page:
                return {"error": "Failed to fetch page"}

            title = ""
            title_el = page.css_first("title")
            if title_el:
                title = title_el.text or ""

            description = ""
            desc_el = page.css_first('meta[name="description"]')
            if desc_el:
                description = desc_el.attrib.get("content", "")

            links = []
            for a in page.css("a[href]")[:50]:
                href = a.attrib.get("href", "")
                if href:
                    links.append(href)

            # Extract emails from page text
            body_text = page.css_first("body").text if page.css_first("body") else ""
            emails = list(set(re.findall(
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                body_text
            )))

            # Extract phones
            phones = list(set(re.findall(
                r'(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
                body_text
            )))

            # Extract social links
            social_links = {}
            html = page.html_content if hasattr(page, 'html_content') else str(page)
            for platform, patterns in {
                "instagram": [r'instagram\.com/([a-zA-Z0-9_.]+)'],
                "facebook": [r'facebook\.com/([a-zA-Z0-9_.]+)'],
                "linkedin": [r'linkedin\.com/(company|in)/([a-zA-Z0-9_-]+)'],
                "twitter": [r'twitter\.com/([a-zA-Z0-9_]+)'],
                "tiktok": [r'tiktok\.com/@([a-zA-Z0-9_.]+)'],
            }.items():
                for pattern in patterns:
                    match = re.search(pattern, html)
                    if match:
                        social_links[platform] = match.group(0)

            return {
                "url": url,
                "title": title,
                "description": description,
                "links": links,
                "emails": emails[:20],
                "phones": phones[:10],
                "social_links": social_links,
            }
        except ImportError:
            logger.warning("Scrapling not installed")
            return {"error": "Scrapling not installed"}
        except Exception as e:
            return {"error": str(e)}

    async def validate(self, config: Dict = None) -> bool:
        try:
            from scrapling import Fetcher
            return True
        except ImportError:
            return False
