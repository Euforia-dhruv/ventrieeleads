"""Clutch.co provider - scrapes agency listings from clutch.co."""
import logging
import re
from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ClutchProvider(BaseProvider):
    name = "Clutch.co"
    slug = "clutch"
    description = "Clutch.co agency directory - leading B2B ratings and reviews"
    requires_browser = False
    supports_map_search = True

    BASE_URL = "https://clutch.co"

    INDUSTRY_MAP = {
        "hotels": "hospitality",
        "restaurants": "food-beverage",
        "medical": "healthcare",
        "dentists": "healthcare",
        "clinics": "healthcare",
        "real estate": "real-estate",
        "construction": "construction",
        "interior": "interior-design",
        "architects": "architecture",
        "gyms": "fitness",
        "salons": "beauty",
        "it companies": "it-services",
        "marketing": "marketing",
        "advertising": "advertising",
        "web design": "web-design",
        "ecommerce": "ecommerce",
        "software": "software-development",
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
        clutch_category = self.INDUSTRY_MAP.get(search_term, search_term.replace(" ", "-"))

        urls_to_try = [
            f"{self.BASE_URL}/agencies/{clutch_category}",
            f"{self.BASE_URL}/search?query={query.replace(' ', '+')}&location={location.replace(' ', '+')}" if location else f"{self.BASE_URL}/search?query={query.replace(' ', '+')}",
        ]

        if location:
            parts = [p.strip().lower().replace(" ", "-") for p in location.split(",") if p.strip()]
            for i, part in enumerate(parts):
                urls_to_try.insert(0, f"{self.BASE_URL}/agencies/{clutch_category}/{part}")
                if i + 1 < len(parts):
                    urls_to_try.insert(0, f"{self.BASE_URL}/agencies/{clutch_category}/{parts[i+1]}/{part}")

        async with httpx.AsyncClient(timeout=20, follow_redirects=True, verify=False) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            }

            for url in urls_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and len(resp.text) > 1000:
                        results = self._parse_listing_page(resp.text, location)
                        if results:
                            break
                except Exception as e:
                    logger.debug(f"Clutch URL failed {url}: {e}")
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

        cards = soup.select('[class*="provider"], [class*="company"], .listing-item, article')
        if not cards:
            cards = soup.select('div[class*="row"]')

        for card in cards[:50]:
            try:
                name_el = card.select_one('h3, h2, [class*="name"], [class*="title"], a[href*="/profile/"]')
                if not name_el:
                    continue

                name = name_el.get_text(strip=True)
                if not name or len(name) < 2:
                    continue

                link = name_el.get("href", "")
                if not link and name_el.find("a"):
                    link = name_el.find("a").get("href", "")
                if link and not link.startswith("http"):
                    link = f"{self.BASE_URL}{link}"

                rating = 0.0
                rating_el = card.select_one('[class*="rating"], [class*="score"], [class*="star"]')
                if rating_el:
                    rating_text = rating_el.get_text(strip=True)
                    match = re.search(r'(\d+\.?\d*)', rating_text)
                    if match:
                        rating = float(match.group(1))

                review_count = 0
                review_el = card.select_one('[class*="review"], [class*="count"]')
                if review_el:
                    review_text = review_el.get_text(strip=True)
                    match = re.search(r'(\d+)', review_text)
                    if match:
                        review_count = int(match.group(1))

                description = ""
                desc_el = card.select_one('[class*="description"], [class*="summary"], p')
                if desc_el:
                    description = desc_el.get_text(strip=True)[:500]

                services = []
                for tag in card.select('[class*="service"], [class*="specialty"], [class*="tag"]'):
                    service_text = tag.get_text(strip=True)
                    if service_text:
                        services.append(service_text)

                results.append(NormalizedLead(
                    name=name,
                    source="clutch",
                    description=description,
                    rating=rating,
                    review_count=review_count,
                    city=parsed_city,
                    country=parsed_country,
                    industry="",
                    metadata={
                        "profile_url": link,
                        "services": services,
                    },
                    raw_data={"source": "clutch", "url": link}
                ))

            except Exception as e:
                logger.debug(f"Failed to parse Clutch card: {e}")
                continue

        return results
