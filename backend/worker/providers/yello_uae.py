"""Yello UAE provider - scrapes yello.ae business directory."""
import logging
import re
from typing import List
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class YelloUAEProvider(BaseProvider):
    name = "Yello UAE"
    slug = "yello_uae"
    description = "Yello UAE - UAE business directory with contact details (UAE only)"
    requires_browser = False
    supported_countries = ["UAE"]

    BASE_URL = "https://www.yello.ae"

    async def search(
        self,
        query: str,
        location: str = "Dubai, UAE",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        results = []
        city = location.split(",")[0].strip() if location else "Dubai"
        search_slug = query.lower().replace(" ", "-").replace("&", "and")

        urls_to_try = [
            f"{self.BASE_URL}/{search_slug}/dubai",
            f"{self.BASE_URL}/{search_slug}/uae",
            f"{self.BASE_URL}/search?search={query.replace(' ', '+')}&city={city}",
        ]

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            }

            for url in urls_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and len(resp.text) > 1000:
                        results = self._parse_listing_page(resp.text, city)
                        if results:
                            break
                except Exception as e:
                    logger.debug(f"Yello URL failed {url}: {e}")
                    continue

        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]

        return results[:max_results]

    def _parse_listing_page(self, html: str, default_city: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []

        cards = soup.select('[class*="listing"], [class*="company"], [class*="business"], [class*="card"]')
        if not cards:
            cards = soup.select('div.row > div')

        for card in cards[:50]:
            try:
                name_el = card.select_one('h2, h3, h4, [class*="name"], [class*="title"]')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                if not name or len(name) < 3:
                    continue

                link = ""
                link_el = name_el.find("a") or card.select_one('a[href*="/company/"]')
                if link_el:
                    link = link_el.get("href", "")
                    if link and not link.startswith("http"):
                        link = f"{self.BASE_URL}{link}"

                phone = ""
                phone_el = card.select_one('[class*="phone"], [href^="tel:"]')
                if phone_el:
                    phone = phone_el.get_text(strip=True) or phone_el.get("href", "").replace("tel:", "")

                address = ""
                addr_el = card.select_one('[class*="address"], [class*="location"]')
                if addr_el:
                    address = addr_el.get_text(strip=True)[:200]

                rating = 0.0
                rating_el = card.select_one('[class*="rating"], [class*="star"]')
                if rating_el:
                    match = re.search(r'(\d+\.?\d*)', rating_el.get_text())
                    if match:
                        rating = float(match.group(1))

                results.append(NormalizedLead(
                    name=name,
                    source="yello_uae",
                    phone=phone,
                    address=address,
                    city=default_city,
                    country="UAE",
                    rating=rating,
                    metadata={"profile_url": link},
                    raw_data={"source": "yello_uae", "url": link}
                ))
            except Exception as e:
                logger.debug(f"Failed to parse Yello card: {e}")
                continue

        return results
