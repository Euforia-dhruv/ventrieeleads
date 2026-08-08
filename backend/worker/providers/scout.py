"""Scout provider — intelligent deep website crawler for lead extraction."""
import logging
import re
import asyncio
from typing import List, Optional, Dict
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from worker.providers.base import BaseProvider, NormalizedLead

logger = logging.getLogger(__name__)


class ScoutProvider(BaseProvider):
    name = "Scout"
    slug = "scout"
    description = "Scout — intelligent deep website crawler for comprehensive business data extraction"
    requires_browser = False
    requires_api_key = False
    supported_countries = ["*"]
    supported_industries = ["*"]
    requests_per_minute = 15
    requests_per_hour = 200
    requests_per_day = 2000
    pricing_tier = "free"
    pricing_per_request = 0.0

    MAX_PAGES = 20
    TIMEOUT = 10
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }
    IMPORTANT_PATHS = [
        "contact", "contact-us", "get-in-touch", "reach-us",
        "about", "about-us", "our-story", "who-we-are", "team",
        "services", "what-we-do", "offerings", "solutions",
        "careers", "jobs", "join-us",
    ]

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self._session: Optional[httpx.AsyncClient] = None

    async def initialize(self) -> bool:
        self._session = httpx.AsyncClient(
            timeout=self.TIMEOUT, follow_redirects=True,
            headers=self.HEADERS, verify=False
        )
        self._is_initialized = True
        logger.info("Scout provider initialized")
        return True

    async def cleanup(self) -> None:
        if self._session:
            await self._session.aclose()
        await super().cleanup()

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

        if not self._session:
            await self.initialize()

        all_leads = []
        for url in urls[:max_results]:
            try:
                lead = await self.crawl_website(url)
                if lead:
                    all_leads.append(lead)
            except Exception as e:
                logger.debug(f"Scout crawl failed for {url}: {e}")

        return all_leads

    async def crawl_website(self, url: str) -> Optional[NormalizedLead]:
        """Deep-crawl a website and extract comprehensive business data."""
        if not self._session:
            await self.initialize()

        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        visited: set = set()
        pages_data: List[Dict] = []

        pages_to_visit = [url]
        for path in self.IMPORTANT_PATHS:
            candidate = f"{base_url}/{path}"
            if candidate not in pages_to_visit:
                pages_to_visit.append(candidate)

        while pages_to_visit and len(visited) < self.MAX_PAGES:
            page_url = pages_to_visit.pop(0)
            if page_url in visited:
                continue
            visited.add(page_url)

            try:
                resp = await self._session.get(page_url)
                if resp.status_code != 200:
                    continue

                html = resp.text
                soup = BeautifulSoup(html, "html.parser")
                text = soup.get_text(separator=" ", strip=True)

                pages_data.append({
                    "url": page_url,
                    "html": html,
                    "text": text,
                    "soup": soup,
                })

                for a in soup.find_all("a", href=True):
                    href = urljoin(page_url, a["href"])
                    href_parsed = urlparse(href)
                    if href_parsed.netloc == parsed.netloc and href not in visited:
                        link_text = a.get_text(strip=True).lower()
                        for imp in self.IMPORTANT_PATHS:
                            if imp in href.lower() or imp in link_text:
                                pages_to_visit.append(href)
                                break

            except Exception as e:
                logger.debug(f"Scout page fetch failed {page_url}: {e}")

        return self._extract_lead(url, pages_data)

    def _extract_lead(self, base_url: str, pages_data: List[Dict]) -> Optional[NormalizedLead]:
        """Extract a NormalizedLead from crawled pages."""
        if not pages_data:
            return None

        main = pages_data[0]
        soup = main["soup"]
        text = main["text"]

        emails = set()
        phones = set()
        social_links = {}
        whatsapp = ""

        all_text = " ".join(p["text"] for p in pages_data)
        all_html = " ".join(p["html"] for p in pages_data)

        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        excluded = {"example.com", "email.com", "test.com", "domain.com", "sentry.io", "w3.org",
                     "schema.org", "googleapis.com", "gstatic.com", "cloudflare.com"}
        for e in re.findall(email_pattern, all_text):
            el = e.lower()
            if not any(ex in el for ex in excluded):
                emails.add(el)

        phone_patterns = [
            r'(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\+971[-.\s]?\d{1,2}[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\+91[-.\s]?\d{5}[-.\s]?\d{5}',
        ]
        for pattern in phone_patterns:
            for match in re.findall(pattern, all_text):
                cleaned = re.sub(r'[^\d+\-()]', '', match)
                if len(cleaned) >= 8:
                    phones.add(cleaned)

        social_patterns = {
            "instagram": r'instagram\.com/([a-zA-Z0-9_.]+)',
            "facebook": r'facebook\.com/([a-zA-Z0-9_.]+)',
            "linkedin": r'linkedin\.com/(?:company|in)/([a-zA-Z0-9_-]+)',
            "twitter": r'(?:twitter|x)\.com/([a-zA-Z0-9_]+)',
            "youtube": r'youtube\.com/(?:@|channel/|c/)([a-zA-Z0-9_-]+)',
            "tiktok": r'tiktok\.com/@([a-zA-Z0-9_.]+)',
        }
        for platform, pattern in social_patterns.items():
            match = re.search(pattern, all_html)
            if match:
                social_links[platform] = match.group(0) if match.group(0).startswith("http") else f"https://{match.group(0)}"

        wa_match = re.search(r'wa\.me/(\d+)|whatsapp\.com/send\?phone=(\d+)', all_html + all_text)
        if wa_match:
            whatsapp = wa_match.group(1) or wa_match.group(2) or ""

        title = ""
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)

        description = ""
        meta = soup.find("meta", attrs={"name": "description"})
        if meta:
            description = meta.get("content", "")
        elif soup.find("meta", attrs={"property": "og:description"}):
            description = soup.find("meta", attrs={"property": "og:description"}).get("content", "")

        logo_url = ""
        for sel in ['img[class*="logo"]', 'img[alt*="logo" i]', 'a[class*="logo"] img', 'header img']:
            img = soup.select_one(sel)
            if img and img.get("src"):
                logo_url = urljoin(base_url, img["src"])
                break

        services = []
        svc_section = soup.find(['section', 'div'], class_=re.compile(r'service|what-we-do|offerings', re.I))
        if svc_section:
            for h in svc_section.find_all(['h2', 'h3', 'h4', 'li']):
                t = h.get_text(strip=True)
                if t:
                    services.append(t)

        name = title.split("|")[0].split("-")[0].strip() if title else urlparse(base_url).netloc.replace("www.", "")

        return NormalizedLead(
            name=name,
            source="scout",
            website=base_url,
            phone=list(phones)[0] if phones else "",
            email=list(emails)[0] if emails else "",
            description=description[:500],
            logo_url=logo_url,
            social_links=social_links,
            metadata={
                "all_emails": list(emails),
                "all_phones": list(phones),
                "whatsapp": whatsapp,
                "services": services[:20],
                "pages_crawled": len(pages_data),
                "title": title,
            },
            raw_data={"base_url": base_url, "pages": len(pages_data)},
        )

    async def enrich(self, lead: NormalizedLead) -> NormalizedLead:
        """Enrich a lead by crawling its website."""
        if not lead.website:
            return lead

        try:
            enriched = await self.crawl_website(lead.website)
            if enriched:
                if not lead.email and enriched.email:
                    lead.email = enriched.email
                if not lead.phone and enriched.phone:
                    lead.phone = enriched.phone
                if not lead.description and enriched.description:
                    lead.description = enriched.description
                if not lead.logo_url and enriched.logo_url:
                    lead.logo_url = enriched.logo_url
                existing_socials = lead.social_links or {}
                existing_socials.update(enriched.social_links or {})
                lead.social_links = existing_socials
                existing_meta = lead.metadata or {}
                existing_meta.update(enriched.metadata or {})
                lead.metadata = existing_meta
        except Exception as e:
            logger.debug(f"Scout enrichment failed for {lead.website}: {e}")

        return lead

    async def health_check(self) -> bool:
        try:
            if not self._session:
                await self.initialize()
            resp = await self._session.get("https://httpbin.org/get")
            return resp.status_code == 200
        except Exception:
            return False
