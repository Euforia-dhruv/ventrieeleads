"""Google Maps scraper using Playwright."""
import asyncio
import re
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)


@dataclass
class GoogleMapsResult:
    name: str
    category: str
    address: str
    website: str
    phone: str
    rating: float
    review_count: int
    opening_hours: Dict
    latitude: float
    longitude: float
    google_maps_url: str
    images: List[str]


class GoogleMapsScraper:
    """Scrape Google Maps for business listings."""

    def __init__(self):
        self.base_url = "https://www.google.com/maps/search/"
        self.timeout = 30000

    async def search(
        self,
        query: str,
        location: str = "Dubai, UAE",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0
    ) -> List[GoogleMapsResult]:
        """Search Google Maps and return business listings."""
        from playwright.async_api import async_playwright

        results = []
        search_query = f"{query} {location}"
        url = f"{self.base_url}{quote_plus(search_query)}"

        logger.info(f"Searching Google Maps: {search_query}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="en-US",
                timezone_id="Asia/Dubai"
            )
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="networkidle", timeout=self.timeout)
                await asyncio.sleep(3)

                results = await self._extract_results(page, max_results)

                if min_rating > 0:
                    results = [r for r in results if r.rating >= min_rating]
                if min_reviews > 0:
                    results = [r for r in results if r.review_count >= min_reviews]

                logger.info(f"Found {len(results)} results from Google Maps, enriching details...")

                for i, result in enumerate(results):
                    if result.google_maps_url:
                        try:
                            details = await self.get_business_details(result.google_maps_url)
                            if details:
                                if details.get("website"):
                                    result.website = details["website"]
                                if details.get("phone"):
                                    result.phone = details["phone"]
                                if details.get("address"):
                                    result.address = details["address"]
                                if details.get("opening_hours"):
                                    result.opening_hours = {"text": details["opening_hours"]}
                                logger.info(f"Enriched [{i+1}/{len(results)}] {result.name}: website={result.website}, phone={result.phone}")
                        except Exception as e:
                            logger.warning(f"Failed to enrich {result.name}: {e}")

            except Exception as e:
                logger.error(f"Google Maps search failed: {e}")
            finally:
                await browser.close()

        return results[:max_results]

    async def _extract_results(self, page, max_results: int) -> List[GoogleMapsResult]:
        """Extract business listings from the page."""
        results = []

        try:
            await page.wait_for_selector('[role="feed"]', timeout=10000)
        except Exception:
            logger.warning("No feed found, trying alternative selectors")

        items = await page.query_selector_all('[role="article"]')
        if not items:
            items = await page.query_selector_all('.Nv2PK')

        for item in items[:max_results]:
            try:
                result = await self._parse_item(item, page)
                if result:
                    results.append(result)
            except Exception as e:
                logger.warning(f"Failed to parse item: {e}")
                continue

        return results

    async def _parse_item(self, item, page) -> Optional[GoogleMapsResult]:
        """Parse a single search result item."""
        try:
            name = await item.get_attribute("aria-label") or ""
            if not name:
                name_el = await item.query_selector(".qBF1Pd")
                name = await name_el.inner_text() if name_el else ""

            if not name:
                return None

            rating = 0.0
            review_count = 0
            rating_el = await item.query_selector(".MW4etd")
            if rating_el:
                rating_text = await rating_el.inner_text()
                try:
                    rating = float(rating_text)
                except ValueError:
                    pass

            reviews_el = await item.query_selector(".UY7F9")
            if reviews_el:
                reviews_text = await reviews_el.inner_text()
                reviews_text = re.sub(r'[^\d]', '', reviews_text)
                try:
                    review_count = int(reviews_text) if reviews_text else 0
                except ValueError:
                    pass

            category = ""
            category_el = await item.query_selector(".W4Efsd span:first-child")
            if category_el:
                category = await category_el.inner_text()

            address = ""
            address_el = await item.query_selector(".W4Efsd .W4Efsd span:last-child")
            if address_el:
                address = await address_el.inner_text()

            link_el = await item.query_selector("a.hfpxzc")
            google_maps_url = await link_el.get_attribute("href") if link_el else ""

            return GoogleMapsResult(
                name=name.strip(),
                category=category.strip(),
                address=address.strip(),
                website="",
                phone="",
                rating=rating,
                review_count=review_count,
                opening_hours={},
                latitude=0.0,
                longitude=0.0,
                google_maps_url=google_maps_url,
                images=[]
            )
        except Exception as e:
            logger.debug(f"Error parsing item: {e}")
            return None

    async def get_business_details(self, google_maps_url: str) -> Optional[Dict]:
        """Get detailed information from a business page."""
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            try:
                await page.goto(google_maps_url, wait_until="networkidle", timeout=self.timeout)
                await asyncio.sleep(2)

                details = {}

                website_el = await page.query_selector('a[data-item-id="authority"]')
                if website_el:
                    details["website"] = await website_el.get_attribute("href") or ""

                phone_el = await page.query_selector('button[data-item-id*="phone"]')
                if phone_el:
                    details["phone"] = await phone_el.inner_text()

                address_el = await page.query_selector('button[data-item-id="address"]')
                if address_el:
                    details["address"] = await address_el.inner_text()

                hours_el = await page.query_selector('[data-item-id="oh"]')
                if hours_el:
                    details["opening_hours"] = await hours_el.inner_text()

                return details

            except Exception as e:
                logger.error(f"Failed to get business details: {e}")
                return None
            finally:
                await browser.close()


google_maps_scraper = GoogleMapsScraper()
