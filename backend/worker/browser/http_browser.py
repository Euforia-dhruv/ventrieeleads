"""HTTP fallback browser - lightweight httpx-based fetching."""
import logging
import os
from typing import Dict, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from worker.browser.base import BaseBrowser, BrowserResult, BrowserType

logger = logging.getLogger(__name__)

HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "15"))


class HTTPBrowser(BaseBrowser):
    """HTTP fallback browser using httpx for simple page fetching."""

    name = "HTTP"
    browser_type = BrowserType.HTTP
    requires_network = True
    supports_javascript = False
    supports_screenshots = False

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.timeout = config.get("timeout", HTTP_TIMEOUT) if config else HTTP_TIMEOUT
        self._client: Optional[httpx.AsyncClient] = None

    async def initialize(self) -> bool:
        """Initialize HTTP client."""
        try:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                },
                verify=False
            )
            self._is_initialized = True
            logger.info("HTTP browser initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize HTTP browser: {e}")
            return False

    async def cleanup(self) -> None:
        """Cleanup HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
        await super().cleanup()

    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Dict[str, str] = None,
        body: str = None,
        timeout: int = 30,
        **kwargs
    ) -> BrowserResult:
        """Fetch a URL using HTTP."""
        if not self._client:
            await self.initialize()

        try:
            request_headers = {}
            if headers:
                request_headers.update(headers)

            if method.upper() == "GET":
                response = await self._client.get(
                    url,
                    headers=request_headers,
                    timeout=timeout
                )
            elif method.upper() == "POST":
                response = await self._client.post(
                    url,
                    content=body,
                    headers=request_headers,
                    timeout=timeout
                )
            else:
                response = await self._client.request(
                    method,
                    url,
                    content=body,
                    headers=request_headers,
                    timeout=timeout
                )

            html = response.text
            soup = BeautifulSoup(html, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            # Extract links
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith(("http://", "https://")):
                    links.append(href)
                elif href.startswith("/"):
                    links.append(urljoin(url, href))

            return BrowserResult(
                success=True,
                html=html,
                url=str(response.url),
                status_code=response.status_code,
                headers=dict(response.headers),
                title=title,
                links=list(set(links)),
                browser_type=BrowserType.HTTP,
                metadata={
                    "content_length": len(html),
                    "encoding": response.encoding,
                }
            )

        except httpx.TimeoutException:
            logger.warning(f"HTTP timeout fetching {url}")
            return BrowserResult(
                success=False,
                url=url,
                error="timeout",
                browser_type=BrowserType.HTTP
            )
        except Exception as e:
            logger.error(f"HTTP fetch failed for {url}: {e}")
            return BrowserResult(
                success=False,
                url=url,
                error=str(e),
                browser_type=BrowserType.HTTP
            )

    async def health_check(self) -> bool:
        """Check if HTTP client is working."""
        if not self._client:
            await self.initialize()

        try:
            response = await self._client.get("https://httpbin.org/get", timeout=5)
            self._is_healthy = response.status_code == 200
            return self._is_healthy
        except Exception as e:
            logger.warning(f"HTTP health check failed: {e}")
            self._is_healthy = False
            return False


# Global instance
_http_instance: Optional[HTTPBrowser] = None


async def get_http_browser(config: Dict = None) -> HTTPBrowser:
    """Get or create HTTP browser instance."""
    global _http_instance
    if _http_instance is None:
        _http_instance = HTTPBrowser(config)
        await _http_instance.initialize()
    return _http_instance
