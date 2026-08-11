"""Google Maps scraper — robust Playwright-based with coordinate extraction, timeout guards, and partial results."""
import asyncio
import re
import logging
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
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
    images: List[str] = field(default_factory=list)


class GoogleMapsScraper:
    """Scrape Google Maps for business listings with stealth + web fallback."""

    BASE_URL = "https://www.google.com/maps/search/"
    PAGE_TIMEOUT_MS = 20_000
    DETAIL_TIMEOUT_MS = 15_000
    OVERALL_TIMEOUT_S = 180
    MAX_DETAIL_ENRICH = 10
    SCROLL_ATTEMPTS = 4
    SCROLL_WAIT_S = 1.2

    CHROMIUM_ARGS = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
    ]

    USER_AGENT = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

    STEALTH_JS = """
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    """

    def __init__(self):
        pass

    # ── public API ────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        location: str = "Dubai, UAE",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        lat: float = 0,
        lng: float = 0,
    ) -> List[GoogleMapsResult]:
        results = await self._search_playwright(
            query, location, max_results, min_rating, min_reviews, lat, lng
        )
        if not results:
            logger.info("Playwright returned 0 results, trying web fallback")
            results = await self._search_web_fallback(
                query, location, max_results, min_rating, min_reviews
            )
        return results

    # ── Playwright scrape ─────────────────────────────────────────

    async def _search_playwright(
        self,
        query: str,
        location: str,
        max_results: int,
        min_rating: float,
        min_reviews: float,
        lat: float = 0,
        lng: float = 0,
    ) -> List[GoogleMapsResult]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed")
            return []

        url = self._build_search_url(query, location, lat, lng)
        logger.info(f"Google Maps search: {url}")

        results: List[GoogleMapsResult] = []
        t0 = time.time()

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True, args=self.CHROMIUM_ARGS
                )
                try:
                    context = await browser.new_context(
                        viewport={"width": 1920, "height": 1080},
                        user_agent=self.USER_AGENT,
                        locale="en-US",
                    )
                    await context.add_init_script(self.STEALTH_JS)
                    page = await context.new_page()

                    # ── load search page ──
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=self.PAGE_TIMEOUT_MS)
                    except Exception as e:
                        logger.error(f"Failed to load Maps page: {e}")
                        return []

                    await asyncio.sleep(3)

                    # ── check for consent / cookie wall ──
                    try:
                        consent = await page.query_selector('button:has-text("Accept all")')
                        if consent:
                            await consent.click()
                            await asyncio.sleep(1)
                    except Exception:
                        pass

                    feed = await page.query_selector('[role="feed"]')
                    if not feed:
                        logger.warning("No [role=feed] found — Maps may have blocked us or layout changed")
                        return []

                    # ── scroll to load results ──
                    for _ in range(self.SCROLL_ATTEMPTS):
                        if time.time() - t0 > self.OVERALL_TIMEOUT_S:
                            logger.warning("Overall timeout reached during scroll")
                            break
                        items = await page.query_selector_all('[role="article"]')
                        if len(items) >= max_results:
                            break
                        await page.evaluate(
                            'document.querySelector(\'[role="feed"]\')?.scrollBy(0, 800)'
                        )
                        await asyncio.sleep(self.SCROLL_WAIT_S)

                    items = await page.query_selector_all('[role="article"]')
                    logger.info(f"Found {len(items)} raw items in feed")

                    # ── parse feed items ──
                    for item in items[:max_results]:
                        if time.time() - t0 > self.OVERALL_TIMEOUT_S:
                            logger.warning("Overall timeout during parsing")
                            break
                        try:
                            result = await self._parse_item(item)
                            if result:
                                results.append(result)
                        except Exception as e:
                            logger.debug(f"Parse item error: {e}")

                    logger.info(f"Parsed {len(results)} results from feed")

                    # ── enrich details in SAME browser context ──
                    enrich_count = min(len(results), self.MAX_DETAIL_ENRICH)
                    enriched = 0
                    for i in range(enrich_count):
                        if time.time() - t0 > self.OVERALL_TIMEOUT_S:
                            logger.warning("Overall timeout during enrichment, returning partial results")
                            break
                        r = results[i]
                        if not r.google_maps_url:
                            continue
                        try:
                            details = await self._get_details(context, r.google_maps_url)
                            if details:
                                if details.get("website"):
                                    r.website = details["website"]
                                if details.get("phone"):
                                    r.phone = details["phone"]
                                if details.get("address"):
                                    r.address = details["address"]
                                if details.get("review_count"):
                                    r.review_count = details["review_count"]
                                if details.get("opening_hours"):
                                    r.opening_hours = {"text": details["opening_hours"]}
                                if details.get("latitude") and not r.latitude:
                                    r.latitude = details["latitude"]
                                if details.get("longitude") and not r.longitude:
                                    r.longitude = details["longitude"]
                                enriched += 1
                        except Exception as e:
                            logger.debug(f"Enrich failed for {r.name}: {e}")

                    logger.info(f"Enriched {enriched}/{enrich_count} detail pages")

                finally:
                    await browser.close()

        except Exception as e:
            logger.error(f"Playwright search failed: {e}")

        # ── extract coordinates from Maps URLs if still zero ──
        for r in results:
            if not r.latitude or r.latitude == 0:
                lat_e, lng_e = self._extract_coords_from_url(r.google_maps_url)
                if lat_e and lng_e:
                    r.latitude = lat_e
                    r.longitude = lng_e

        # ── apply filters ──
        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]
        if min_reviews > 0:
            results = [r for r in results if r.review_count >= min_reviews]

        logger.info(f"Final: {len(results)} results (after filters)")
        return results[:max_results]

    # ── build URL ─────────────────────────────────────────────────

    def _build_search_url(self, query: str, location: str, lat: float, lng: float) -> str:
        if lat and lng:
            return f"{self.BASE_URL}{quote_plus(query)}/@{lat},{lng},14z"
        search = f"{query} {location}".strip()
        return f"{self.BASE_URL}{quote_plus(search)}"

    # ── parse a single feed item ──────────────────────────────────

    async def _parse_item(self, item) -> Optional[GoogleMapsResult]:
        try:
            # Name: try aria-label first, then .qBF1Pd, then .fontHeadlineSmall
            name = await item.get_attribute("aria-label") or ""
            if not name:
                for sel in [".qBF1Pd", ".fontHeadlineSmall", "a.hfpxzc span"]:
                    el = await item.query_selector(sel)
                    if el:
                        name = await el.inner_text()
                        if name.strip():
                            break
            if not name or not name.strip():
                return None
            name = name.strip()

            # Rating: .MW4etd has the numeric rating
            rating = 0.0
            for sel in [".MW4etd", ".ZkP5Je"]:
                el = await item.query_selector(sel)
                if el:
                    try:
                        txt = await el.inner_text()
                        nums = re.search(r'[\d.]+', txt)
                        if nums:
                            rating = float(nums.group())
                            break
                    except Exception:
                        pass

            # Review count: Google Maps feed NO LONGER shows review counts.
            # Only ratings are shown in the feed. Reviews are on detail page.
            review_count = 0

            # Category: first span inside .W4Efsd
            category = ""
            cat_el = await item.query_selector(".W4Efsd span:first-child")
            if cat_el:
                category = self._clean_text(await cat_el.inner_text())

            # Address: last span inside .W4Efsd
            address = ""
            addr_el = await item.query_selector(".W4Efsd .W4Efsd span:last-child")
            if not addr_el:
                addr_el = await item.query_selector(".W4Efsd span[style*='direction']")
            if addr_el:
                address = self._clean_text(await addr_el.inner_text())

            # Maps URL
            link_el = await item.query_selector("a.hfpxzc, a[href*='/maps/place/']")
            maps_url = await link_el.get_attribute("href") if link_el else ""

            # Extract coords from URL
            lat, lng = 0.0, 0.0
            if maps_url:
                lat, lng = self._extract_coords_from_url(maps_url)

            return GoogleMapsResult(
                name=name,
                category=category.strip(),
                address=address.strip(),
                website="",
                phone="",
                rating=rating,
                review_count=review_count,
                opening_hours={},
                latitude=lat,
                longitude=lng,
                google_maps_url=maps_url,
                images=[],
            )
        except Exception as e:
            logger.debug(f"Error parsing Maps item: {e}")
            return None

    # ── extract coordinates from Maps URL ─────────────────────────

    @staticmethod
    def _extract_coords_from_url(url: str) -> Tuple[float, float]:
        """Extract lat/lng from a Google Maps URL."""
        if not url:
            return 0.0, 0.0

        # Format 1: @lat,lng,zoom
        m = re.search(r'@(-?\d+\.?\d*),(-?\d+\.?\d*)', url)
        if m:
            return float(m.group(1)), float(m.group(2))

        # Format 2: !3dlat!4dlng
        m = re.search(r'!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)', url)
        if m:
            return float(m.group(1)), float(m.group(2))

        return 0.0, 0.0

    # ── get details from a place page ─────────────────────────────

    async def _get_details(self, context, google_maps_url: str) -> Optional[Dict]:
        """Get business details from a Maps place page using an EXISTING browser context."""
        page = None
        try:
            page = await context.new_page()
            await page.goto(google_maps_url, wait_until="domcontentloaded", timeout=self.DETAIL_TIMEOUT_MS)
            await asyncio.sleep(2)

            details: Dict = {}

            # Website — data-item-id="authority" (any element type)
            el = await page.query_selector('[data-item-id="authority"]')
            if el:
                href = await el.get_attribute("href") or ""
                if not href:
                    # The href might be on a child <a> element
                    a_el = await el.query_selector("a")
                    if a_el:
                        href = await a_el.get_attribute("href") or ""
                if href and href.startswith("http"):
                    details["website"] = href

            # Phone — data-item-id contains "phone" (any element type)
            # The phone number is often IN the data-item-id: "phone:tel:+97142756731"
            el = await page.query_selector('[data-item-id*="phone"]')
            if el:
                di = await el.get_attribute("data-item-id") or ""
                # Extract phone from data-item-id: "phone:tel:+97142756731"
                phone_match = re.search(r'tel:(.+)', di)
                if phone_match:
                    details["phone"] = phone_match.group(1)
                else:
                    txt = self._clean_text(await el.inner_text())
                    if txt:
                        details["phone"] = txt

            # Address — data-item-id="address"
            el = await page.query_selector('[data-item-id="address"]')
            if el:
                txt = self._clean_text(await el.inner_text())
                if txt:
                    details["address"] = txt

            # Review count — look in body text for "N reviews"
            body_text = await page.inner_text("body")
            review_match = re.search(r'([\d,]+)\s*reviews?', body_text, re.I)
            if review_match:
                details["review_count"] = int(review_match.group(1).replace(",", ""))

            # Opening hours
            el = await page.query_selector('[data-item-id="oh"]')
            if el:
                details["opening_hours"] = await el.inner_text()

            # Coordinates from page URL
            page_url = page.url
            lat, lng = self._extract_coords_from_url(page_url)
            if lat and lng:
                details["latitude"] = lat
                details["longitude"] = lng

            return details

        except Exception as e:
            logger.debug(f"Detail page failed: {e}")
            return None
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass

    # ── web fallback (no browser needed) ──────────────────────────

    async def _search_web_fallback(
        self,
        query: str,
        location: str,
        max_results: int,
        min_rating: float,
        min_reviews: float,
    ) -> List[GoogleMapsResult]:
        search_term = f"{query} {location} site:google.com/maps"
        results: List[GoogleMapsResult] = []

        try:
            async with httpx.AsyncClient(
                timeout=15,
                follow_redirects=True,
                headers={
                    "User-Agent": self.USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            ) as client:
                resp = await client.get(
                    "https://www.google.com/search",
                    params={"q": search_term, "num": max_results},
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
                    rm = re.search(r'(\d+\.?\d*)\s*stars?', snippet, re.I)
                    if rm:
                        try:
                            rating = float(rm.group(1))
                        except ValueError:
                            pass
                    rvm = re.search(r'([\d,]+)\s*reviews?', snippet, re.I)
                    if rvm:
                        reviews = int(rvm.group(1).replace(",", ""))

                    address = ""
                    am = re.search(r'(?:address|located in|at)\s+([^·,]+)', snippet, re.I)
                    if am:
                        address = am.group(1).strip()

                    lat, lng = self._extract_coords_from_url(link)

                    results.append(GoogleMapsResult(
                        name=name,
                        category="",
                        address=address,
                        website="",
                        phone="",
                        rating=rating,
                        review_count=reviews,
                        opening_hours={},
                        latitude=lat,
                        longitude=lng,
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

    # ── helpers ───────────────────────────────────────────────────

    @staticmethod
    def _clean_text(text: str) -> str:
        text = re.sub(r'[\ue000-\uefff\u200d\ufeff]+', '', text)
        text = text.strip()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return lines[0] if lines else text


google_maps_scraper = GoogleMapsScraper()
