"""Instant Data Scraper provider — browser-assisted structured data extraction."""
import logging
import re
from typing import List, Optional, Dict
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class InstantDataScraperProvider(BaseProvider):
    name = "Instant Data Scraper"
    slug = "instant_data_scraper"
    description = "Instant Data Scraper — browser-assisted structured data extraction from any webpage"
    requires_browser = False
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 15
    requests_per_hour = 200
    requests_per_day = 2000
    pricing_tier = "free"
    pricing_per_request = 0.0

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }

    LIST_PATTERNS = [
        "listing", "card", "result", "item", "entry", "post",
        "company", "business", "agency", "provider", "firm",
    ]

    def __init__(self, config: Dict = None):
        super().__init__(config)

    async def search(
        self,
        query: str,
        location: str = "",
        max_results: int = 50,
        min_rating: float = 0,
        min_reviews: int = 0,
        **kwargs
    ) -> List[NormalizedLead]:
        urls = kwargs.get("urls", [])
        if not urls:
            return []

        all_leads = []
        async with httpx.AsyncClient(timeout=15, headers=self.HEADERS, follow_redirects=True, verify=False) as client:
            for url in urls[:max_results]:
                try:
                    leads = await self._extract_from_page(client, url, max_results)
                    all_leads.extend(leads)
                except Exception as e:
                    logger.debug(f"Instant Data Scraper failed for {url}: {e}")

        return all_leads[:max_results]

    async def _extract_from_page(
        self,
        client: httpx.AsyncClient,
        url: str,
        max_results: int
    ) -> List[NormalizedLead]:
        """Extract structured data from a webpage."""
        resp = await client.get(url)
        if resp.status_code != 200:
            return []

        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator=" ", strip=True)

        cards = []
        for pattern in self.LIST_PATTERNS:
            found = soup.select(f'[class*="{pattern}"], [class*="{pattern.title()}"]')
            cards.extend(found)

        if not cards:
            found = soup.select("article, .row > .col, .grid > div, ul > li")
            cards.extend(found)

        seen = set()
        leads = []
        for card in cards[:max_results * 2]:
            try:
                lead = self._parse_card(card, url, text)
                if lead and lead.name not in seen:
                    seen.add(lead.name)
                    leads.append(lead)
            except Exception:
                continue

        return leads[:max_results]

    def _parse_card(self, card, page_url: str, page_text: str) -> Optional[NormalizedLead]:
        """Parse a single card element into a NormalizedLead."""
        name_el = card.select_one('h1, h2, h3, h4, [class*="name"], [class*="title"]')
        if not name_el:
            return None

        name = name_el.get_text(strip=True)
        if not name or len(name) < 2 or len(name) > 200:
            return None

        link = ""
        link_el = card.select_one('a[href]')
        if link_el:
            link = link_el.get("href", "")
            if link and not link.startswith("http"):
                from urllib.parse import urljoin
                link = urljoin(page_url, link)

        phone = ""
        phone_el = card.select_one('[href^="tel:"], [class*="phone"]')
        if phone_el:
            phone = phone_el.get_text(strip=True) or phone_el.get("href", "").replace("tel:", "")

        email = ""
        email_el = card.select_one('[href^="mailto:"]')
        if email_el:
            email = email_el.get("href", "").replace("mailto:", "")
        else:
            card_text = card.get_text()
            email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', card_text)
            if email_match:
                email = email_match.group(0)

        address = ""
        addr_el = card.select_one('[class*="address"], [class*="location"]')
        if addr_el:
            address = addr_el.get_text(strip=True)[:200]

        rating = 0.0
        rating_el = card.select_one('[class*="rating"], [class*="score"], [class*="star"]')
        if rating_el:
            match = re.search(r'(\d+\.?\d*)', rating_el.get_text())
            if match:
                rating = float(match.group(1))

        description = ""
        desc_el = card.select_one('[class*="desc"], p')
        if desc_el:
            description = desc_el.get_text(strip=True)[:500]

        return NormalizedLead(
            name=name,
            source="instant_data_scraper",
            website=link,
            phone=phone,
            email=email,
            address=address,
            rating=rating,
            description=description,
            raw_data={"page_url": page_url},
        )

    async def enrich(self, lead: NormalizedLead) -> NormalizedLead:
        if not lead.website:
            return lead

        try:
            async with httpx.AsyncClient(timeout=15, headers=self.HEADERS, follow_redirects=True, verify=False) as client:
                resp = await client.get(lead.website)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    text = soup.get_text(separator=" ", strip=True)

                    if not lead.email:
                        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
                        if email_match:
                            lead.email = email_match.group(0)

                    if not lead.phone:
                        phone_match = re.search(r'(?:\+?[\d]{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
                        if phone_match:
                            lead.phone = phone_match.group(0).strip()

                    if not lead.description:
                        meta = soup.find("meta", attrs={"name": "description"})
                        if meta:
                            lead.description = meta.get("content", "")[:500]
        except Exception as e:
            logger.debug(f"Instant Data Scraper enrichment failed: {e}")

        return lead

    async def health_check(self) -> bool:
        return True
