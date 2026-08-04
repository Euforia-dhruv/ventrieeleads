"""Browser abstraction layer with Lightpanda, Playwright, and HTTP fallback."""
import logging
from worker.browser.manager import BrowserManager, get_browser_manager

logger = logging.getLogger(__name__)

__all__ = ["BrowserManager", "get_browser_manager"]
