"""Website scraper for extracting contact info and social links — Scrapling-first with httpx fallback."""
import re
import logging
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class WebsiteScraper:
    """Scrape company websites for contact information using Scrapling (primary) or httpx (fallback)."""

    def __init__(self):
        self.timeout = 15
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    async def scrape(self, url: str) -> Dict:
        """Scrape a website and extract information. Tries Scrapling first, falls back to httpx."""
        logger.info(f"Scraping website: {url}")

        result = {
            "url": url,
            "title": "",
            "description": "",
            "logo_url": "",
            "emails": [],
            "phone_numbers": [],
            "whatsapp": "",
            "instagram": "",
            "facebook": "",
            "linkedin": "",
            "youtube": "",
            "tiktok": "",
            "contact_page": "",
            "about_page": "",
            "services": [],
            "metadata": {}
        }

        # Try Scrapling first (better anti-bot bypass)
        try:
            from scrapling import Fetcher
            fetcher = Fetcher(auto_match=False)
            page = fetcher.get(url, timeout=self.timeout, headless=True, stealthy_headers=True)

            if page and page.status == 200:
                html = page.html_content if hasattr(page, 'html_content') else str(page)
                soup = BeautifulSoup(html, "html.parser")
                text = soup.get_text(separator=" ", strip=True)

                result["title"] = self._extract_title(soup)
                result["description"] = self._extract_description(soup)
                result["logo_url"] = self._extract_logo(soup, url)
                result["emails"] = self._extract_emails(text)
                result["phone_numbers"] = self._extract_phones(text)
                result["whatsapp"] = self._extract_whatsapp(soup, text)
                result["instagram"] = self._extract_social(soup, "instagram")
                result["facebook"] = self._extract_social(soup, "facebook")
                result["linkedin"] = self._extract_social(soup, "linkedin")
                result["youtube"] = self._extract_social(soup, "youtube")
                result["tiktok"] = self._extract_social(soup, "tiktok")
                result["services"] = self._extract_services(soup, text)

                contact_page = await self._find_contact_page(soup, url, None)
                result["contact_page"] = contact_page

                about_page = await self._find_about_page(soup, url, None)
                result["about_page"] = about_page

                logger.info(f"Scrapling scraped {url}: {len(result['emails'])} emails, {len(result['phone_numbers'])} phones")
                return result
        except ImportError:
            logger.debug("Scrapling not installed, using httpx fallback")
        except Exception as e:
            logger.debug(f"Scrapling scrape failed for {url}: {e}, falling back to httpx")

        # Fallback to httpx + BeautifulSoup
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers,
                verify=False
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text

                soup = BeautifulSoup(html, "html.parser")
                text = soup.get_text(separator=" ", strip=True)

                result["title"] = self._extract_title(soup)
                result["description"] = self._extract_description(soup)
                result["logo_url"] = self._extract_logo(soup, url)
                result["emails"] = self._extract_emails(text)
                result["phone_numbers"] = self._extract_phones(text)
                result["whatsapp"] = self._extract_whatsapp(soup, text)
                result["instagram"] = self._extract_social(soup, "instagram")
                result["facebook"] = self._extract_social(soup, "facebook")
                result["linkedin"] = self._extract_social(soup, "linkedin")
                result["youtube"] = self._extract_social(soup, "youtube")
                result["tiktok"] = self._extract_social(soup, "tiktok")
                result["services"] = self._extract_services(soup, text)

                contact_page = await self._find_contact_page(soup, url, client)
                result["contact_page"] = contact_page

                about_page = await self._find_about_page(soup, url, client)
                result["about_page"] = about_page

                if contact_page:
                    try:
                        contact_response = await client.get(contact_page)
                        contact_soup = BeautifulSoup(contact_response.text, "html.parser")
                        contact_text = contact_soup.get_text(separator=" ", strip=True)

                        extra_emails = self._extract_emails(contact_text)
                        extra_phones = self._extract_phones(contact_text)
                        result["emails"] = list(set(result["emails"] + extra_emails))
                        result["phone_numbers"] = list(set(result["phone_numbers"] + extra_phones))
                    except Exception:
                        pass

                logger.info(f"httpx scraped {url}: {len(result['emails'])} emails, {len(result['phone_numbers'])} phones")

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")

        return result

    def _extract_title(self, soup: BeautifulSoup) -> str:
        title_tag = soup.find("title")
        return title_tag.get_text(strip=True) if title_tag else ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        meta = soup.find("meta", attrs={"name": "description"})
        if meta:
            return meta.get("content", "")
        meta = soup.find("meta", attrs={"property": "og:description"})
        if meta:
            return meta.get("content", "")
        return ""

    def _extract_logo(self, soup: BeautifulSoup, base_url: str) -> str:
        selectors = [
            'img[class*="logo"]',
            'img[alt*="logo" i]',
            'img[src*="logo"]',
            'img[class*="brand"]',
            'a[class*="logo"] img',
            '.logo img',
            '#logo img',
            'header img',
        ]
        for selector in selectors:
            img = soup.select_one(selector)
            if img:
                src = img.get("src", "")
                if src:
                    return urljoin(base_url, src)
        return ""

    def _extract_emails(self, text: str) -> List[str]:
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, text)
        excluded = [
            'example.com', 'email.com', 'test.com', 'domain.com',
            'sentry.io', 'wixpress.com', 'w3.org', 'schema.org',
            'googleapis.com', 'gstatic.com', 'cloudflare.com',
            'jquery.com', 'wordpress.org', 'wordpress.com'
        ]
        return list(set([
            e.lower() for e in emails
            if not any(ex in e.lower() for ex in excluded)
        ]))

    def _extract_phones(self, text: str) -> List[str]:
        phone_patterns = [
            r'(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\+971[-.\s]?\d{1,2}[-.\s]?\d{3}[-.\s]?\d{4}',
            r'0\d{2,3}[-.\s]?\d{3}[-.\s]?\d{4}',
        ]
        phones = set()
        for pattern in phone_patterns:
            found = re.findall(pattern, text)
            for phone in found:
                cleaned = re.sub(r'[^\d+\-()]', '', phone)
                if len(cleaned) >= 8:
                    phones.add(cleaned)
        return list(phones)

    def _extract_whatsapp(self, soup: BeautifulSoup, text: str) -> str:
        whatsapp_patterns = [
            r'wa\.me/(\d+)',
            r'whatsapp\.com/send\?phone=(\d+)',
            r'whatsapp://send\?phone=(\d+)',
        ]
        full_text = str(soup) + " " + text
        for pattern in whatsapp_patterns:
            match = re.search(pattern, full_text)
            if match:
                return match.group(1)
        return ""

    def _extract_social(self, soup: BeautifulSoup, platform: str) -> str:
        patterns = {
            "instagram": [
                r'instagram\.com/([a-zA-Z0-9_.]+)',
                r'instagr\.am/([a-zA-Z0-9_.]+)',
            ],
            "facebook": [
                r'facebook\.com/([a-zA-Z0-9_.]+)',
                r'fb\.com/([a-zA-Z0-9_.]+)',
                r'fb\.me/([a-zA-Z0-9_.]+)',
            ],
            "linkedin": [
                r'linkedin\.com/company/([a-zA-Z0-9_-]+)',
                r'linkedin\.com/in/([a-zA-Z0-9_-]+)',
                r'linkedin\.com/school/([a-zA-Z0-9_-]+)',
            ],
            "youtube": [
                r'youtube\.com/@([a-zA-Z0-9_-]+)',
                r'youtube\.com/channel/([a-zA-Z0-9_-]+)',
                r'youtube\.com/c/([a-zA-Z0-9_-]+)',
                r'youtube\.com/user/([a-zA-Z0-9_-]+)',
            ],
            "tiktok": [
                r'tiktok\.com/@([a-zA-Z0-9_.]+)',
                r'tiktok\.com/@([a-zA-Z0-9_.]+)/video',
            ],
        }
        html = str(soup)
        for pattern in patterns.get(platform, []):
            match = re.search(pattern, html)
            if match:
                return match.group(0)
        return ""

    def _extract_services(self, soup: BeautifulSoup, text: str) -> List[str]:
        services = []
        service_section = soup.find(['section', 'div'], class_=re.compile(r'service|what-we-do|offerings', re.I))
        if service_section:
            headings = service_section.find_all(['h2', 'h3', 'h4', 'li'])
            services = [h.get_text(strip=True) for h in headings if h.get_text(strip=True)]
        return services[:20]

    async def _find_contact_page(self, soup: BeautifulSoup, base_url: str, client: httpx.AsyncClient) -> str:
        contact_patterns = ['contact', 'contact-us', 'get-in-touch', 'reach-us', 'contactus']
        return await self._find_page(soup, base_url, client, contact_patterns)

    async def _find_about_page(self, soup: BeautifulSoup, base_url: str, client: httpx.AsyncClient) -> str:
        about_patterns = ['about', 'about-us', 'about-the-company', 'our-story', 'who-we-are']
        return await self._find_page(soup, base_url, client, about_patterns)

    async def _find_page(self, soup: BeautifulSoup, base_url: str, client: httpx.AsyncClient, patterns: List[str]) -> str:
        links = soup.find_all("a", href=True)
        for link in links:
            href = link.get("href", "").lower()
            text = link.get_text(strip=True).lower()
            for pattern in patterns:
                if pattern in href or pattern in text:
                    full_url = urljoin(base_url, link["href"])
                    try:
                        resp = await client.head(full_url, timeout=5)
                        if resp.status_code == 200:
                            return full_url
                    except Exception:
                        pass
        return ""


website_scraper = WebsiteScraper()
