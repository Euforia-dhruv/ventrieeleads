"""Scrapling provider - advanced anti-bot web scraping."""
import logging
import os
from typing import List, Optional, Dict
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ScraplingProvider(BaseProvider):
    name = "Scrapling"
    slug = "scrapling"
    description = "Scrapling - Python scraper with auto-detection and anti-bot bypass"
    requires_browser = True
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
        self._scrapling = None

    async def initialize(self) -> bool:
        try:
            from scrapling import Fetcher
            self._scrapling = Fetcher(auto_match=False)
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
        url = kwargs.get("url")
        if not url:
            return []

        try:
            from scrapling import Fetcher
            fetcher = Fetcher(auto_match=False)

            page = fetcher.get(url)

            if not page:
                return []

            results = []
            cards = page.css('[class*="card"], [class*="listing"], article, div[class*="result"]')

            for card in cards[:max_results]:
                try:
                    name_el = card.css_first('h2, h3, [class*="name"], [class*="title"]')
                    if not name_el:
                        continue

                    name = name_el.text.strip()
                    if not name or len(name) < 2:
                        continue

                    link_el = card.css_first('a[href]')
                    link = link_el.attrib.get("href", "") if link_el else ""

                    results.append(NormalizedLead(
                        name=name,
                        source="scrapling",
                        website=link,
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

    async def scrape_page(self, url: str) -> Dict:
        """Scrape a single page and extract structured data."""
        try:
            from scrapling import Fetcher
            fetcher = Fetcher(auto_match=False)
            page = fetcher.get(url)

            if not page:
                return {"error": "Failed to fetch page"}

            return {
                "url": url,
                "title": page.css_first("title").text if page.css_first("title") else "",
                "description": page.css_first('meta[name="description"]').attrib.get("content", "") if page.css_first('meta[name="description"]') else "",
                "links": [a.attrib.get("href", "") for a in page.css("a[href]")][:50],
                "emails": [],
                "phones": [],
            }
        except Exception as e:
            return {"error": str(e)}

    async def validate(self, config: Dict = None) -> bool:
        try:
            from scrapling import Fetcher
            return True
        except ImportError:
            return False
