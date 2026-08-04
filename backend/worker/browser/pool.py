"""Browser pool for managing concurrent browser instances."""
import asyncio
import logging
import os
from typing import Dict, List, Optional, Type
from collections import defaultdict

from worker.browser.base import BaseBrowser, BrowserType

logger = logging.getLogger(__name__)

MAX_CONCURRENT = int(os.getenv("BROWSER_MAX_CONCURRENT", "5"))
MAX_PER_TYPE = int(os.getenv("BROWSER_MAX_PER_TYPE", "3"))


class BrowserPool:
    """Pool for managing multiple browser instances with rate limiting."""

    def __init__(
        self,
        max_concurrent: int = MAX_CONCURRENT,
        max_per_type: int = MAX_PER_TYPE
    ):
        self.max_concurrent = max_concurrent
        self.max_per_type = max_per_type
        self._browsers: Dict[str, BaseBrowser] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._type_semaphores: Dict[BrowserType, asyncio.Semaphore] = {}
        self._usage_count: Dict[str, int] = defaultdict(int)
        self._error_count: Dict[str, int] = defaultdict(int)

    def _get_type_semaphore(self, browser_type: BrowserType) -> asyncio.Semaphore:
        """Get or create semaphore for browser type."""
        if browser_type not in self._type_semaphores:
            self._type_semaphores[browser_type] = asyncio.Semaphore(self.max_per_type)
        return self._type_semaphores[browser_type]

    def register(self, slug: str, browser: BaseBrowser) -> None:
        """Register a browser instance in the pool."""
        self._browsers[slug] = browser
        logger.info(f"Registered browser {slug} ({browser.name}) in pool")

    def get(self, slug: str) -> Optional[BaseBrowser]:
        """Get a browser by slug."""
        return self._browsers.get(slug)

    def get_by_type(self, browser_type: BrowserType) -> Optional[BaseBrowser]:
        """Get first available browser of a specific type."""
        for browser in self._browsers.values():
            if browser.browser_type == browser_type and browser.is_ready:
                return browser
        return None

    async def acquire(self, slug: str) -> Optional[BaseBrowser]:
        """Acquire a browser from the pool with rate limiting."""
        browser = self._browsers.get(slug)
        if not browser:
            logger.warning(f"Browser {slug} not found in pool")
            return None

        if not browser.is_ready:
            await browser.initialize()

        # Wait for global semaphore
        await self._semaphore.acquire()

        # Wait for type semaphore
        type_sem = self._get_type_semaphore(browser.browser_type)
        await type_sem.acquire()

        self._usage_count[slug] += 1
        return browser

    async def release(self, slug: str) -> None:
        """Release a browser back to the pool."""
        browser = self._browsers.get(slug)
        if browser:
            self._semaphore.release()
            type_sem = self._get_type_semaphore(browser.browser_type)
            type_sem.release()

    async def execute(
        self,
        slug: str,
        func,
        *args,
        **kwargs
    ):
        """Execute a function with a browser from the pool."""
        browser = await self.acquire(slug)
        if not browser:
            raise ValueError(f"Browser {slug} not available")

        try:
            result = await func(browser, *args, **kwargs)
            return result
        except Exception as e:
            self._error_count[slug] += 1
            logger.error(f"Browser {slug} execution failed: {e}")
            raise
        finally:
            await self.release(slug)

    def get_stats(self) -> Dict:
        """Get pool statistics."""
        return {
            "total_browsers": len(self._browsers),
            "browsers": {
                slug: {
                    "name": b.name,
                    "type": b.browser_type.value,
                    "is_ready": b.is_ready,
                    "usage_count": self._usage_count[slug],
                    "error_count": self._error_count[slug],
                }
                for slug, b in self._browsers.items()
            },
            "max_concurrent": self.max_concurrent,
            "max_per_type": self.max_per_type,
        }

    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all browsers in the pool."""
        results = {}
        for slug, browser in self._browsers.items():
            try:
                results[slug] = await browser.health_check()
            except Exception as e:
                logger.error(f"Health check failed for {slug}: {e}")
                results[slug] = False
        return results

    async def cleanup_all(self) -> None:
        """Cleanup all browsers in the pool."""
        for slug, browser in self._browsers.items():
            try:
                await browser.cleanup()
            except Exception as e:
                logger.error(f"Cleanup failed for {slug}: {e}")
        self._browsers.clear()
        logger.info("Browser pool cleaned up")


# Global pool instance
_pool: Optional[BrowserPool] = None


def get_browser_pool() -> BrowserPool:
    """Get or create the global browser pool."""
    global _pool
    if _pool is None:
        _pool = BrowserPool()
    return _pool
