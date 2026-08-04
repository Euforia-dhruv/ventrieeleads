"""Contra.com provider - scrapes agency listings from contra.com."""
import logging
import re
from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ContraProvider(BaseProvider):
    name = "Contra"
    slug = "contra"
    description = "Contra.com - independent agency directory"
    requires_browser = False
    supported_countries = ["*"]
    supported_industries = ["marketing", "design", "development", "branding"]

    BASE_URL = "https://contra.com"

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
        search_term = query.lower().strip()

        urls_to_try = [
            f"{self.BASE_URL}/agencies",
            f"{self.BASE_URL}/search?q={query.replace(' ', '+')}",
        ]

        if location:
            urls_to_try.insert(0, f"{self.BASE_URL}/agencies?location={location.replace(' ', '+')}")

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
                    logger.debug(f"Contra URL failed {url}: {e}")
                    continue

        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]
        if min_reviews > 0:
            results = [r for r in results if r.review_count >= min_reviews]

        return results[:max_results]

    def _parse_listing_page(self, html: str, default_location: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []

        cards = soup.select('[class*="card"], [class*="agency"], [class*="listing"], article')
        if not cards:
            cards = soup.select('div[class*="grid"] > div')

        for card in cards[:50]:
            try:
                name_el = card.select_one('h2, h3, [class*="name"], [class*="title"]')
                if not name_el:
                    continue

                name = name_el.get_text(strip=True)
                if not name or len(name) < 2:
                    continue

                link_el = card.select_one('a[href]')
                link = link_el["href"] if link_el else ""
                if link and not link.startswith("http"):
                    link = f"{self.BASE_URL}{link}"

                rating = 0.0
                rating_el = card.select_one('[class*="rating"], [class*="score"]')
                if rating_el:
                    match = re.search(r'(\d+\.?\d*)', rating_el.get_text(strip=True))
                    if match:
                        rating = float(match.group(1))

                description = ""
                desc_el = card.select_one('[class*="description"], p')
                if desc_el:
                    description = desc_el.get_text(strip=True)[:500]

                results.append(NormalizedLead(
                    name=name,
                    source="contra",
                    website=link,
                    description=description,
                    rating=rating,
                    metadata={"profile_url": link},
                    raw_data={"source": "contra", "url": link}
                ))

            except Exception as e:
                logger.debug(f"Failed to parse Contra card: {e}")
                continue

        return results
