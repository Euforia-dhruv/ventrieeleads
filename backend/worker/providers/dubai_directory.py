"""Dubai business directory provider."""
import logging
import re
from typing import List
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class DubaiDirectoryProvider(BaseProvider):
    name = "Dubai Directory"
    slug = "dubai_directory"
    description = "Dubai business directory listings (UAE only)"
    requires_browser = False
    supported_countries = ["UAE"]

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

        search_urls = [
            f"https://www.dubaiphonebook.com/search?q={query.replace(' ', '+')}",
            f"https://www.yellowpages-uae.com/search?q={query.replace(' ', '+')}&loc=Dubai",
        ]

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            }

            for url in search_urls:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and len(resp.text) > 500:
                        results = self._parse_page(resp.text, city)
                        if results:
                            break
                except Exception as e:
                    logger.debug(f"Dubai directory URL failed {url}: {e}")
                    continue

        return results[:max_results]

    def _parse_page(self, html: str, default_city: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []

        cards = soup.select('[class*="listing"], [class*="company"], [class*="business"], [class*="result"]')
        if not cards:
            cards = soup.select('div.item, div.row > div.col')

        for card in cards[:50]:
            try:
                name_el = card.select_one('h2, h3, h4, a[class*="name"], [class*="title"]')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                if not name or len(name) < 3:
                    continue

                phone = ""
                phone_el = card.select_one('[href^="tel:"], [class*="phone"]')
                if phone_el:
                    phone = phone_el.get_text(strip=True) or phone_el.get("href", "").replace("tel:", "")

                address = ""
                addr_el = card.select_one('[class*="address"], [class*="location"]')
                if addr_el:
                    address = addr_el.get_text(strip=True)[:200]

                results.append(NormalizedLead(
                    name=name,
                    source="dubai_directory",
                    phone=phone,
                    address=address,
                    city=default_city,
                    country="UAE",
                    raw_data={"source": "dubai_directory"}
                ))
            except Exception as e:
                logger.debug(f"Failed to parse directory card: {e}")
                continue

        return results
