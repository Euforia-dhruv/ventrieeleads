"""Screenshot service using Playwright."""
import os
import logging
import uuid
from typing import Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "/app/data/screenshots")


class ScreenshotService:
    """Capture screenshots of websites."""

    def __init__(self):
        self.dir = Path(SCREENSHOTS_DIR)
        self.dir.mkdir(parents=True, exist_ok=True)

    async def capture(
        self,
        url: str,
        company_id: str,
        desktop: bool = True,
        mobile: bool = True,
        full_page: bool = True
    ) -> Dict[str, str]:
        """Capture screenshots of a website."""
        from playwright.async_api import async_playwright

        results = {}

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)

            if desktop:
                results["desktop"] = await self._capture_viewport(
                    browser, url, company_id, "desktop",
                    width=1920, height=1080, full_page=full_page
                )

            if mobile:
                results["mobile"] = await self._capture_viewport(
                    browser, url, company_id, "mobile",
                    width=375, height=812, full_page=full_page
                )

            await browser.close()

        logger.info(f"Captured screenshots for {url}: {list(results.keys())}")
        return results

    async def _capture_viewport(
        self,
        browser,
        url: str,
        company_id: str,
        device: str,
        width: int,
        height: int,
        full_page: bool
    ) -> str:
        """Capture a screenshot with specific viewport."""
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US",
            timezone_id="Asia/Dubai"
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)

            filename = f"{company_id}_{device}_{uuid.uuid4().hex[:8]}.png"
            filepath = self.dir / filename

            await page.screenshot(
                path=str(filepath),
                full_page=full_page,
                type="png"
            )

            logger.info(f"Screenshot saved: {filepath}")
            return str(filepath)

        except Exception as e:
            logger.error(f"Screenshot failed for {url} ({device}): {e}")
            return ""
        finally:
            await context.close()


screenshot_service = ScreenshotService()
