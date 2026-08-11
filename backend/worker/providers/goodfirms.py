"""GoodFirms provider - scrapes agency listings from goodfirms.co."""
import logging
import re
from typing import List
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class GoodFirmsProvider(BaseProvider):
    name = "GoodFirms"
    slug = "goodfirms"
    description = "GoodFirms.co - top software development and service companies"
    requires_browser = False
    supports_map_search = True

    BASE_URL = "https://www.goodfirms.co"

    INDUSTRY_MAP = {
        "web design": "web-design",
        "web development": "web-development",
        "software": "software-development",
        "mobile": "mobile-app-development",
        "ecommerce": "ecommerce",
        "marketing": "digital-marketing",
        "seo": "seo",
        "it companies": "it-services",
    }

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
        gf_category = self.INDUSTRY_MAP.get(search_term, search_term.replace(" ", "-"))

        urls_to_try = [
            f"{self.BASE_URL}/{gf_category}/companies",
            f"{self.BASE_URL}/search?query={query.replace(' ', '+')}",
        ]

        if location:
            parts = [p.strip().lower().replace(" ", "-") for p in location.split(",") if p.strip()]
            for part in reversed(parts):
                urls_to_try.insert(0, f"{self.BASE_URL}/{gf_category}/companies/{part}")

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
                    logger.debug(f"GoodFirms URL failed {url}: {e}")
                    continue

        if min_rating > 0:
            results = [r for r in results if r.rating >= min_rating]
        if min_reviews > 0:
            results = [r for r in results if r.review_count >= min_reviews]

        return results[:max_results]

    def _parse_listing_page(self, html: str, default_city: str) -> List[NormalizedLead]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        city_parts = [p.strip() for p in default_city.split(",")] if default_city else []
        parsed_city = city_parts[0] if city_parts else ""
        parsed_country = city_parts[1] if len(city_parts) > 1 else ""

        cards = soup.select('[class*="company-card"], [class*="listing"], [class*="firm"], article')
        if not cards:
            cards = soup.select('div.row')

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

                rating = 0.0
                rating_el = card.select_one('[class*="rating"], [class*="score"]')
                if rating_el:
                    match = re.search(r'(\d+\.?\d*)', rating_el.get_text())
                    if match:
                        rating = float(match.group(1))

                review_count = 0
                review_el = card.select_one('[class*="review"]')
                if review_el:
                    match = re.search(r'(\d+)', review_el.get_text())
                    if match:
                        review_count = int(match.group(1))

                pricing = ""
                price_el = card.select_one('[class*="price"], [class*="rate"], [class*="cost"]')
                if price_el:
                    pricing = price_el.get_text(strip=True)[:100]

                employees = ""
                emp_el = card.select_one('[class*="employee"], [class*="team"], [class*="size"]')
                if emp_el:
                    employees = emp_el.get_text(strip=True)[:50]

                results.append(NormalizedLead(
                    name=name,
                    source="goodfirms",
                    city=parsed_city,
                    country=parsed_country,
                    rating=rating,
                    review_count=review_count,
                    metadata={
                        "profile_url": link,
                        "pricing": pricing,
                        "employees": employees,
                    },
                    raw_data={"source": "goodfirms", "url": link}
                ))
            except Exception as e:
                logger.debug(f"Failed to parse GoodFirms card: {e}")
                continue

        return results
