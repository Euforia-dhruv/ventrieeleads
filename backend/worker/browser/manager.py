"""Browser manager with fallback chain (Lightpanda → Playwright → HTTP)."""
import logging
import os
from typing import Dict, List, Optional

from worker.browser.base import BaseBrowser, BrowserResult, BrowserType
from worker.browser.pool import BrowserPool, get_browser_pool

logger = logging.getLogger(__name__)

FALLBACK_CHAIN = os.getenv("BROWSER_FALLBACK_CHAIN", "lightpanda,playwright,http").split(",")


class BrowserManager:
    """Manages browser backends with automatic fallback."""

    def __init__(self, fallback_chain: List[str] = None):
        self.fallback_chain = fallback_chain or FALLBACK_CHAIN
        self.pool = get_browser_pool()
        self._initialized = False

    async def initialize(self) -> bool:
        """Initialize all browsers in the fallback chain."""
        if self._initialized:
            return True

        for slug in self.fallback_chain:
            slug = slug.strip()
            try:
                browser = await self._create_browser(slug)
                if browser:
                    await browser.initialize()
                    self.pool.register(slug, browser)
                    logger.info(f"Initialized browser: {slug}")
            except Exception as e:
                logger.error(f"Failed to initialize browser {slug}: {e}")

        self._initialized = True
        return True

    async def _create_browser(self, slug: str) -> Optional[BaseBrowser]:
        """Create a browser instance by slug."""
        if slug == "lightpanda":
            from worker.browser.lightpanda import LightpandaBrowser
            return LightpandaBrowser()
        elif slug == "playwright":
            from worker.browser.playwright_browser import PlaywrightBrowser
            return PlaywrightBrowser()
        elif slug == "http":
            from worker.browser.http_browser import HTTPBrowser
            return HTTPBrowser()
        else:
            logger.warning(f"Unknown browser slug: {slug}")
            return None

    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Dict[str, str] = None,
        body: str = None,
        timeout: int = 30,
        prefer_javascript: bool = False,
        **kwargs
    ) -> BrowserResult:
        """Fetch a URL with automatic fallback."""
        if not self._initialized:
            await self.initialize()

        # Sort browsers by preference
        if prefer_javascript:
            # Prefer JS-capable browsers
            ordered_slugs = [
                s for s in self.fallback_chain
                if s.strip() in ["lightpanda", "playwright"]
            ] + [s for s in self.fallback_chain if s.strip() == "http"]
        else:
            ordered_slugs = self.fallback_chain

        last_error = None

        for slug in ordered_slugs:
            slug = slug.strip()
            browser = self.pool.get(slug)

            if not browser or not browser.is_ready:
                continue

            try:
                logger.debug(f"Trying {slug} for {url}")
                result = await browser.fetch(
                    url=url,
                    method=method,
                    headers=headers,
                    body=body,
                    timeout=timeout,
                    **kwargs
                )

                if result.success:
                    logger.info(f"Successfully fetched {url} using {slug}")
                    return result

                last_error = result.error
                logger.warning(f"{slug} failed for {url}: {result.error}")

            except Exception as e:
                last_error = str(e)
                logger.error(f"{slug} exception for {url}: {e}")

        # All browsers failed
        logger.error(f"All browsers failed for {url}. Last error: {last_error}")
        return BrowserResult(
            success=False,
            url=url,
            error=f"All browsers failed. Last error: {last_error}",
            browser_type=BrowserType.HTTP
        )

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
        """Take a screenshot using Playwright (only JS-capable browser)."""
        if not self._initialized:
            await self.initialize()

        # Try Playwright first for screenshots
        for slug in ["playwright", "lightpanda"]:
            browser = self.pool.get(slug)
            if browser and browser.supports_screenshots and browser.is_ready:
                try:
                    if slug == "playwright":
                        result = await browser.screenshot(
                            url=url,
                            filename=filename,
                            full_page=full_page,
                            viewport_width=viewport_width,
                            viewport_height=viewport_height,
                            timeout=timeout,
                            **kwargs
                        )
                        if result.success:
                            return result
                except Exception as e:
                    logger.error(f"Screenshot failed with {slug}: {e}")

        return BrowserResult(
            success=False,
            url=url,
            error="No screenshot-capable browser available",
            browser_type=BrowserType.HTTP
        )

    async def fetch_with_javascript(
        self,
        url: str,
        wait_for: str = None,
        timeout: int = 30,
        **kwargs
    ) -> BrowserResult:
        """Fetch a URL that requires JavaScript rendering."""
        if not self._initialized:
            await self.initialize()

        # Try Lightpanda CDP first
        lightpanda = self.pool.get("lightpanda")
        if lightpanda and lightpanda.is_ready:
            try:
                from worker.browser.lightpanda import LightpandaBrowser
                if isinstance(lightpanda, LightpandaBrowser):
                    result = await lightpanda.fetch_with_cdp(
                        url=url,
                        wait_for=wait_for,
                        timeout=timeout,
                        **kwargs
                    )
                    if result.success:
                        return result
            except Exception as e:
                logger.warning(f"Lightpanda CDP failed: {e}")

        # Fallback to Playwright
        playwright = self.pool.get("playwright")
        if playwright and playwright.is_ready:
            try:
                result = await playwright.fetch(
                    url=url,
                    timeout=timeout,
                    wait_until="networkidle",
                    **kwargs
                )
                if result.success:
                    return result
            except Exception as e:
                logger.warning(f"Playwright fetch failed: {e}")

        # Final fallback to HTTP
        return await self.fetch(url=url, timeout=timeout, **kwargs)

    async def health_check(self) -> Dict[str, bool]:
        """Check health of all browsers."""
        if not self._initialized:
            await self.initialize()
        return await self.pool.health_check_all()

    async def get_stats(self) -> Dict:
        """Get pool statistics."""
        return self.pool.get_stats()

    async def cleanup(self) -> None:
        """Cleanup all browsers."""
        await self.pool.cleanup_all()
        self._initialized = False


# Global manager instance
_manager: Optional[BrowserManager] = None


async def get_browser_manager() -> BrowserManager:
    """Get or create the global browser manager."""
    global _manager
    if _manager is None:
        _manager = BrowserManager()
        await _manager.initialize()
    return _manager
