"""Crunchbase provider - scrapes company listings from crunchbase.com."""
import logging
import re
from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class CrunchbaseProvider(BaseProvider):
    name = "Crunchbase"
    slug = "crunchbase"
    description = "Crunchbase.com - company and startup directory"
    requires_browser = True
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["technology", "finance", "healthcare", "saas"]

    BASE_URL = "https://www.crunchbase.com"

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

        search_term = query.replace(" ", "+")
        urls_to_try = [
            f"{self.BASE_URL}/search/organizations?q={search_term}",
        ]

        if location:
            urls_to_try[0] += f"&location={location.replace(' ', '+')}"

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            }

            for url in urls_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and len(resp.text) > 1000:
                        results = self._parse_search_page(resp.text, location)
                        if results:
                            break
                except Exception as e:
                    logger.debug(f"Crunchbase URL failed {url}: {e}")
                    continue

        return results[:max_results]

    def _parse_search_page(self, html: str, default_location: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []

        # Crunchbase uses JavaScript rendering, try to find any server-rendered content
        cards = soup.select('[class*="card"], [class*="company"], [class*="result"], tr')
        if not cards:
            cards = soup.select('div[class*="list"] > div')

        for card in cards[:50]:
            try:
                name_el = card.select_one('h2, h3, [class*="name"], [class*="title"], a[href*="/organization/"]')
                if not name_el:
                    continue

                name = name_el.get_text(strip=True)
                if not name or len(name) < 2:
                    continue

                link_el = card.select_one('a[href*="/organization/"]')
                link = link_el["href"] if link_el else ""
                if link and not link.startswith("http"):
                    link = f"{self.BASE_URL}{link}"

                description = ""
                desc_el = card.select_one('[class*="description"], p')
                if desc_el:
                    description = desc_el.get_text(strip=True)[:500]

                # Extract location if available
                location_text = ""
                location_el = card.select_one('[class*="location"], [class*="headquarters"]')
                if location_el:
                    location_text = location_el.get_text(strip=True)

                city = ""
                country = ""
                if location_text:
                    parts = [p.strip() for p in location_text.split(",")]
                    if parts:
                        city = parts[0]
                    if len(parts) > 1:
                        country = parts[-1]

                results.append(NormalizedLead(
                    name=name,
                    source="crunchbase",
                    website=link,
                    description=description,
                    city=city or default_location.split(",")[0].strip() if default_location else "",
                    country=country or default_location.split(",")[-1].strip() if default_location else "",
                    metadata={"profile_url": link},
                    raw_data={"source": "crunchbase", "url": link}
                ))

            except Exception as e:
                logger.debug(f"Failed to parse Crunchbase card: {e}")
                continue

        return results
