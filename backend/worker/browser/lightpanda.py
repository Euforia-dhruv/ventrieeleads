"""Lightpanda browser backend - Zig-based headless browser with CDP support."""
import asyncio
import json
import logging
import os
from typing import Dict, Optional, Any
from urllib.parse import urljoin

import httpx

from worker.browser.base import BaseBrowser, BrowserResult, BrowserType

logger = logging.getLogger(__name__)

LIGHTPANDA_URL = os.getenv("LIGHTPANDA_URL", "http://localhost:8080")
LIGHTPANDA_CDP_URL = os.getenv("LIGHTPANDA_CDP_URL", "ws://localhost:9222")
LIGHTPANDA_TIMEOUT = int(os.getenv("LIGHTPANDA_TIMEOUT", "30"))


class LightpandaBrowser(BaseBrowser):
    """Lightpanda browser backend using HTTP API and CDP WebSocket."""

    name = "Lightpanda"
    browser_type = BrowserType.LIGHTPANDA
    requires_network = True
    supports_javascript = True
    supports_screenshots = False

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.base_url = config.get("url", LIGHTPANDA_URL) if config else LIGHTPANDA_URL
        self.cdp_url = config.get("cdp_url", LIGHTPANDA_CDP_URL) if config else LIGHTPANDA_CDP_URL
        self.timeout = config.get("timeout", LIGHTPANDA_TIMEOUT) if config else LIGHTPANDA_TIMEOUT
        self._client: Optional[httpx.AsyncClient] = None
        self._ws_connection = None

    async def initialize(self) -> bool:
        """Initialize Lightpanda HTTP client."""
        try:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
            )
            self._is_initialized = True
            logger.info(f"Lightpanda browser initialized at {self.base_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Lightpanda: {e}")
            return False

    async def cleanup(self) -> None:
        """Cleanup HTTP client and WebSocket connections."""
        if self._client:
            await self._client.aclose()
            self._client = None
        if self._ws_connection:
            try:
                await self._ws_connection.close()
            except Exception:
                pass
            self._ws_connection = None
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
        """Fetch a URL using Lightpanda HTTP API."""
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
            title = self._extract_title(html)
            links = self._extract_links(html, url)

            return BrowserResult(
                success=True,
                html=html,
                url=str(response.url),
                status_code=response.status_code,
                headers=dict(response.headers),
                title=title,
                links=links,
                browser_type=BrowserType.LIGHTPANDA,
                metadata={
                    "content_length": len(html),
                    "encoding": response.encoding,
                }
            )

        except httpx.TimeoutException:
            logger.warning(f"Lightpanda timeout fetching {url}")
            return BrowserResult(
                success=False,
                url=url,
                error="timeout",
                browser_type=BrowserType.LIGHTPANDA
            )
        except Exception as e:
            logger.error(f"Lightpanda fetch failed for {url}: {e}")
            return BrowserResult(
                success=False,
                url=url,
                error=str(e),
                browser_type=BrowserType.LIGHTPANDA
            )

    async def fetch_with_cdp(
        self,
        url: str,
        wait_for: str = None,
        timeout: int = 30,
        **kwargs
    ) -> BrowserResult:
        """Fetch using Chrome DevTools Protocol for JS-rendered pages."""
        try:
            import websockets
        except ImportError:
            logger.warning("websockets not installed, falling back to HTTP")
            return await self.fetch(url, timeout=timeout)

        try:
            # Connect to CDP endpoint
            async with websockets.connect(self.cdp_url) as ws:
                # Navigate to URL
                await ws.send(json.dumps({
                    "id": 1,
                    "method": "Page.navigate",
                    "params": {"url": url}
                }))

                # Wait for response
                response = await asyncio.wait_for(ws.recv(), timeout=timeout)

                # Wait for page load
                if wait_for:
                    await ws.send(json.dumps({
                        "id": 2,
                        "method": "Runtime.evaluate",
                        "params": {
                            "expression": f"document.querySelector('{wait_for}') !== null",
                            "awaitPromise": True
                        }
                    }))
                    await asyncio.wait_for(ws.recv(), timeout=timeout)

                # Get page content
                await ws.send(json.dumps({
                    "id": 3,
                    "method": "Runtime.evaluate",
                    "params": {"expression": "document.documentElement.outerHTML"}
                }))

                content_response = await asyncio.wait_for(ws.recv(), timeout=timeout)
                content_data = json.loads(content_response)

                html = content_data.get("result", {}).get("result", {}).get("value", "")
                title = self._extract_title(html)
                links = self._extract_links(html, url)

                return BrowserResult(
                    success=True,
                    html=html,
                    url=url,
                    status_code=200,
                    title=title,
                    links=links,
                    browser_type=BrowserType.LIGHTPANDA,
                    metadata={"cdp": True}
                )

        except asyncio.TimeoutError:
            logger.warning(f"CDP timeout fetching {url}")
            return BrowserResult(
                success=False,
                url=url,
                error="cdp_timeout",
                browser_type=BrowserType.LIGHTPANDA
            )
        except Exception as e:
            logger.error(f"CDP fetch failed for {url}: {e}")
            return await self.fetch(url, timeout=timeout)

    async def health_check(self) -> bool:
        """Check if Lightpanda is reachable."""
        if not self._client:
            await self.initialize()

        try:
            response = await self._client.get("/", timeout=5)
            self._is_healthy = response.status_code < 500
            return self._is_healthy
        except Exception as e:
            logger.warning(f"Lightpanda health check failed: {e}")
            self._is_healthy = False
            return False

    def _extract_title(self, html: str) -> str:
        """Extract title from HTML."""
        import re
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""

    def _extract_links(self, html: str, base_url: str) -> list:
        """Extract links from HTML."""
        import re
        from bs4 import BeautifulSoup

        try:
            soup = BeautifulSoup(html, "html.parser")
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith(("http://", "https://")):
                    links.append(href)
                elif href.startswith("/"):
                    links.append(urljoin(base_url, href))
            return list(set(links))
        except Exception:
            return []


# Global instance
_lightpanda_instance: Optional[LightpandaBrowser] = None


async def get_lightpanda(config: Dict = None) -> LightpandaBrowser:
    """Get or create Lightpanda browser instance."""
    global _lightpanda_instance
    if _lightpanda_instance is None:
        _lightpanda_instance = LightpandaBrowser(config)
        await _lightpanda_instance.initialize()
    return _lightpanda_instance
