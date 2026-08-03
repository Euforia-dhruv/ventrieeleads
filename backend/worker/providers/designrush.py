"""DesignRush provider - scrapes agency listings from designrush.com."""
import logging
import re
from typing import List
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class DesignRushProvider(BaseProvider):
    name = "DesignRush"
    slug = "designrush"
    description = "DesignRush.com - top agency rankings and reviews"
    requires_browser = False

    BASE_URL = "https://www.designrush.com"

    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        results = []
        search_term = query.lower().replace(" ", "-")

        urls_to_try = [
            f"{self.BASE_URL}/agencies/{search_term}",
            f"{self.BASE_URL}/search?query={query.replace(' ', '+')}",
        ]

        if location:
            parts = [p.strip().lower().replace(" ", "-") for p in location.split(",") if p.strip()]
            for part in reversed(parts):
                urls_to_try.insert(0, f"{self.BASE_URL}/agencies/{part}/{search_term}")
                urls_to_try.insert(0, f"{self.BASE_URL}/agencies/{part}")

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            }

            for url in urls_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and len(resp.text) > 1000:
                        results = self._parse_listing_page(resp.text, location)
                        if results:
                            break
                except Exception as e:
                    logger.debug(f"DesignRush URL failed {url}: {e}")
                    continue

        return results[:max_results]

    def _parse_listing_page(self, html: str, default_city: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        city_parts = [p.strip() for p in default_city.split(",")] if default_city else []
        parsed_city = city_parts[0] if city_parts else ""
        parsed_country = city_parts[1] if len(city_parts) > 1 else ""

        cards = soup.select('[class*="agency"], [class*="listing"], [class*="company"], article')
        for card in cards[:50]:
            try:
                name_el = card.select_one('h2, h3, [class*="name"], [class*="title"]')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                if not name or len(name) < 2:
                    continue

                link_el = name_el.find("a") or (name_el if name_el.name == "a" else None)
                link = link_el.get("href", "") if link_el else ""
                if link and not link.startswith("http"):
                    link = f"{self.BASE_URL}{link}"

                description = ""
                desc_el = card.select_one('[class*="desc"], p')
                if desc_el:
                    description = desc_el.get_text(strip=True)[:500]

                results.append(NormalizedLead(
                    name=name,
                    source="designrush",
                    description=description,
                    city=parsed_city,
                    country=parsed_country,
                    metadata={"profile_url": link},
                    raw_data={"source": "designrush", "url": link}
                ))
            except Exception as e:
                logger.debug(f"Failed to parse DesignRush card: {e}")
                continue

        return results
