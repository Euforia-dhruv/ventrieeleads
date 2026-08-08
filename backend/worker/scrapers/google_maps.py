"""Google Maps scraper with stealth and web-search fallback."""
import asyncio
import re
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib.parse import quote_plus
import httpx
from bs4 import BeautifulSoup

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
    """Scrape Google Maps for business listings with stealth + web fallback."""

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
        """Try browser scrape first, fall back to web search if blocked."""
        results = await self._search_playwright(query, location, max_results, min_rating, min_reviews)
        if not results:
            logger.info("Playwright Maps scrape returned 0, falling back to Google Search web scrape")
            results = await self._search_web_fallback(query, location, max_results, min_rating, min_reviews)
        return results

    async def _search_playwright(
        self, query: str, location: str,
        max_results: int, min_rating: float, min_reviews: float
    ) -> List[GoogleMapsResult]:
        """Playwright-based Google Maps scrape with stealth."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed")
            return []

        results = []
        search_query = f"{query} {location}"
        url = f"{self.base_url}{quote_plus(search_query)}"

        logger.info(f"Searching Google Maps (Playwright): {search_query}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="en-US",
                timezone_id="Asia/Dubai",
            )
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                window.chrome = { runtime: {} };
            """)
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
                await asyncio.sleep(5)

                feed = await page.query_selector('[role="feed"]')
                if not feed:
                    logger.warning("No feed found, Maps may have blocked us")
                    return []

                scroll_count = 0
                while scroll_count < 5:
                    items = await page.query_selector_all('[role="article"]')
                    if len(items) >= max_results:
                        break
                    await page.evaluate('document.querySelector(\'[role="feed"]\')?.scrollBy(0, 800)')
                    await asyncio.sleep(1.5)
                    scroll_count += 1

                items = await page.query_selector_all('[role="article"]')
                for item in items[:max_results]:
                    try:
                        result = await self._parse_item(item)
                        if result:
                            results.append(result)
                    except Exception as e:
                        logger.debug(f"Parse item error: {e}")

                logger.info(f"Playwright found {len(results)} results, enriching details...")

                for i, result in enumerate(results):
                    if result.google_maps_url:
                        try:
                            details = await self._get_details_playwright(result.google_maps_url)
                            if details:
                                if details.get("website"):
                                    result.website = details["website"]
                                if details.get("phone"):
                                    result.phone = details["phone"]
                                if details.get("address"):
                                    result.address = details["address"]
                                if details.get("opening_hours"):
                                    result.opening_hours = {"text": details["opening_hours"]}
                                logger.info(f"Enriched [{i+1}/{len(results)}] {result.name}")
                        except Exception as e:
                            logger.debug(f"Enrich failed for {result.name}: {e}")

            except Exception as e:
                logger.error(f"Google Maps Playwright search failed: {e}")
            finally:
                await browser.close()

        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]
        if min_reviews > 0:
            results = [r for r in results if r.review_count >= min_reviews]

        return results[:max_results]

    async def _search_web_fallback(
        self, query: str, location: str,
        max_results: int, min_rating: float, min_reviews: float
    ) -> List[GoogleMapsResult]:
        """Fallback: scrape Google Search 'near me' results (no browser needed)."""
        search_term = f"{query} {location} site:google.com/maps"
        results = []

        try:
            async with httpx.AsyncClient(
                timeout=15, follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                }
            ) as client:
                resp = await client.get(
                    "https://www.google.com/search",
                    params={"q": search_term, "num": max_results}
                )
                if resp.status_code != 200:
                    logger.warning(f"Google Search returned {resp.status_code}")
                    return []

                soup = BeautifulSoup(resp.text, "html.parser")

                for g in soup.select("div.g, div[data-sokoban-container]"):
                    title_el = g.select_one("h3")
                    if not title_el:
                        continue
                    name = title_el.get_text(strip=True)
                    link_el = g.select_one("a[href]")
                    link = link_el["href"] if link_el else ""
                    snippet_el = g.select_one("div[data-sncf], .VwiC3b")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                    rating = 0.0
                    reviews = 0
                    rating_match = re.search(r'(\d+\.?\d*)\s*stars?', snippet, re.I)
                    if rating_match:
                        try:
                            rating = float(rating_match.group(1))
                        except ValueError:
                            pass
                    review_match = re.search(r'([\d,]+)\s*reviews?', snippet, re.I)
                    if review_match:
                        reviews = int(review_match.group(1).replace(",", ""))

                    address = ""
                    addr_match = re.search(r'(?:address|located in|at)\s+([^·,]+)', snippet, re.I)
                    if addr_match:
                        address = addr_match.group(1).strip()

                    results.append(GoogleMapsResult(
                        name=name,
                        category="",
                        address=address,
                        website="",
                        phone="",
                        rating=rating,
                        review_count=reviews,
                        opening_hours={},
                        latitude=0.0,
                        longitude=0.0,
                        google_maps_url=link,
                        images=[],
                    ))

                    if len(results) >= max_results:
                        break

        except Exception as e:
            logger.error(f"Google Search fallback failed: {e}")

        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]
        if min_reviews > 0:
            results = [r for r in results if r.review_count >= min_reviews]

        return results[:max_results]

    @staticmethod
    def _clean_text(text: str) -> str:
        """Strip unicode control characters and leading/trailing cruft."""
        text = re.sub(r'[\ue000-\uefff\u200d\ufeff]+', '', text)
        text = text.strip()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return lines[0] if lines else text

    async def _parse_item(self, item) -> Optional[GoogleMapsResult]:
        """Parse a single search result item from Maps feed."""
        try:
            name = await item.get_attribute("aria-label") or ""
            if not name:
                name_el = await item.query_selector(".qBF1Pd")
                name = await name_el.inner_text() if name_el else ""
            if not name:
                return None

            rating = 0.0
            rating_el = await item.query_selector(".MW4etd")
            if rating_el:
                try:
                    rating = float(await rating_el.inner_text())
                except ValueError:
                    pass

            review_count = 0
            reviews_el = await item.query_selector(".UY7F9")
            if reviews_el:
                text = re.sub(r'[^\d]', '', await reviews_el.inner_text())
                review_count = int(text) if text else 0

            category = ""
            category_el = await item.query_selector(".W4Efsd span:first-child")
            if category_el:
                category = self._clean_text(await category_el.inner_text())

            address = ""
            address_el = await item.query_selector(".W4Efsd .W4Efsd span:last-child")
            if address_el:
                address = self._clean_text(await address_el.inner_text())

            link_el = await item.query_selector("a.hfpxzc")
            maps_url = await link_el.get_attribute("href") if link_el else ""

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
                google_maps_url=maps_url,
                images=[],
            )
        except Exception as e:
            logger.debug(f"Error parsing Maps item: {e}")
            return None

    async def _get_details_playwright(self, google_maps_url: str) -> Optional[Dict]:
        """Get business details from a Google Maps place page."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            return None

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            await context.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
            page = await context.new_page()

            try:
                await page.goto(google_maps_url, wait_until="domcontentloaded", timeout=self.timeout)
                await asyncio.sleep(3)

                details = {}

                website_el = await page.query_selector('a[data-item-id="authority"]')
                if website_el:
                    details["website"] = await website_el.get_attribute("href") or ""

                phone_el = await page.query_selector('button[data-item-id*="phone"]')
                if phone_el:
                    details["phone"] = self._clean_text(await phone_el.inner_text())

                address_el = await page.query_selector('button[data-item-id="address"]')
                if address_el:
                    details["address"] = self._clean_text(await address_el.inner_text())

                hours_el = await page.query_selector('[data-item-id="oh"]')
                if hours_el:
                    details["opening_hours"] = await hours_el.inner_text()

                return details

            except Exception as e:
                logger.debug(f"Failed to get details: {e}")
                return None
            finally:
                await browser.close()


google_maps_scraper = GoogleMapsScraper()
