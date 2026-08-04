"""Playwright browser backend - full-featured browser automation."""
import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Dict, Optional, List

from worker.browser.base import BaseBrowser, BrowserResult, BrowserType

logger = logging.getLogger(__name__)

SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "/app/data/screenshots")


class PlaywrightBrowser(BaseBrowser):
    """Playwright browser backend for JavaScript-rendered pages and screenshots."""

    name = "Playwright"
    browser_type = BrowserType.PLAYWRIGHT
    requires_network = True
    supports_javascript = True
    supports_screenshots = True

    def __init__(self, config: Dict = None):
        super().__init__(config)
        self.headless = config.get("headless", True) if config else True
        self.slow_mo = config.get("slow_mo", 0) if config else 0
        self.screenshots_dir = Path(config.get("screenshots_dir", SCREENSHOTS_DIR) if config else SCREENSHOTS_DIR)
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        self._playwright = None
        self._browser = None

    async def initialize(self) -> bool:
        """Initialize Playwright browser."""
        try:
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=self.headless,
                slow_mo=self.slow_mo
            )
            self._is_initialized = True
            logger.info("Playwright browser initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Playwright: {e}")
            return False

    async def cleanup(self) -> None:
        """Cleanup Playwright resources."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        await super().cleanup()

    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Dict[str, str] = None,
        body: str = None,
        timeout: int = 30,
        wait_until: str = "networkidle",
        **kwargs
    ) -> BrowserResult:
        """Fetch a URL using Playwright."""
        if not self._browser:
            await self.initialize()

        context = None
        try:
            context = await self._browser.new_context(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                locale="en-US",
                timezone_id="Asia/Dubai"
            )

            if headers:
                await context.set_extra_http_headers(headers)

            page = await context.new_page()

            response = await page.goto(
                url,
                wait_until=wait_until,
                timeout=timeout * 1000
            )

            # Wait for dynamic content
            await page.wait_for_timeout(2000)

            html = await page.content()
            title = await page.title()
            current_url = page.url

            # Extract links
            links = await page.evaluate("""
                () => Array.from(document.querySelectorAll('a[href]'))
                    .map(a => a.href)
                    .filter(href => href.startsWith('http'))
            """)

            status_code = response.status if response else 200

            return BrowserResult(
                success=True,
                html=html,
                url=current_url,
                status_code=status_code,
                title=title,
                links=list(set(links)),
                browser_type=BrowserType.PLAYWRIGHT,
                metadata={
                    "wait_until": wait_until,
                }
            )

        except Exception as e:
            logger.error(f"Playwright fetch failed for {url}: {e}")
            return BrowserResult(
                success=False,
                url=url,
                error=str(e),
                browser_type=BrowserType.PLAYWRIGHT
            )
        finally:
            if context:
                await context.close()

    async def screenshot(
        self,
        url: str,
        filename: str = None,
        full_page: bool = True,
        viewport_width: int = 1920,
        viewport_height: int = 1080,
        timeout: int = 30,
        **kwargs
    ) -> BrowserResult:
        """Take a screenshot of a URL."""
        if not self._browser:
            await self.initialize()

        context = None
        try:
            context = await self._browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="en-US",
                timezone_id="Asia/Dubai"
            )

            page = await context.new_page()

            await page.goto(url, wait_until="networkidle", timeout=timeout * 1000)
            await page.wait_for_timeout(2000)

            if not filename:
                filename = f"screenshot_{uuid.uuid4().hex[:8]}.png"

            filepath = self.screenshots_dir / filename

            await page.screenshot(
                path=str(filepath),
                full_page=full_page,
                type="png"
            )

            html = await page.content()
            title = await page.title()

            return BrowserResult(
                success=True,
                html=html,
                url=page.url,
                status_code=200,
                title=title,
                screenshot=str(filepath),
                browser_type=BrowserType.PLAYWRIGHT,
                metadata={
                    "full_page": full_page,
                    "viewport": f"{viewport_width}x{viewport_height}",
                }
            )

        except Exception as e:
            logger.error(f"Playwright screenshot failed for {url}: {e}")
            return BrowserResult(
                success=False,
                url=url,
                error=str(e),
                browser_type=BrowserType.PLAYWRIGHT
            )
        finally:
            if context:
                await context.close()

    async def health_check(self) -> bool:
        """Check if Playwright is available."""
        try:
            from playwright.async_api import async_playwright
            self._is_healthy = True
            return True
        except ImportError:
            logger.warning("Playwright not installed")
            self._is_healthy = False
            return False


# Global instance
_playwright_instance: Optional[PlaywrightBrowser] = None


async def get_playwright_browser(config: Dict = None) -> PlaywrightBrowser:
    """Get or create Playwright browser instance."""
    global _playwright_instance
    if _playwright_instance is None:
        _playwright_instance = PlaywrightBrowser(config)
        await _playwright_instance.initialize()
    return _playwright_instance
