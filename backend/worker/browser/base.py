"""Abstract base class for all browser backends."""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)


class BrowserType(str, Enum):
    LIGHTPANDA = "lightpanda"
    PLAYWRIGHT = "playwright"
    HTTP = "http"


@dataclass
class BrowserResult:
    """Result from a browser operation."""
    success: bool
    html: str = ""
    url: str = ""
    status_code: int = 0
    headers: Dict[str, str] = field(default_factory=dict)
    cookies: Dict[str, str] = field(default_factory=dict)
    title: str = ""
    links: List[str] = field(default_factory=list)
    screenshot: str = ""
    error: str = ""
    browser_type: BrowserType = BrowserType.HTTP
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "html": self.html[:1000] if self.html else "",
            "url": self.url,
            "status_code": self.status_code,
            "title": self.title,
            "links_count": len(self.links),
            "error": self.error,
            "browser_type": self.browser_type.value,
        }


class BaseBrowser(ABC):
    """Base class all browser backends must extend."""

    name: str = "BaseBrowser"
    browser_type: BrowserType = BrowserType.HTTP
    requires_network: bool = True
    supports_javascript: bool = False
    supports_screenshots: bool = False

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self._is_initialized = False
        self._is_healthy = True

    @property
    def is_ready(self) -> bool:
        return self._is_initialized

    async def initialize(self) -> bool:
        """One-time initialization."""
        self._is_initialized = True
        logger.info(f"Browser {self.name} initialized")
        return True

    async def cleanup(self) -> None:
        """Cleanup resources."""
        self._is_initialized = False
        logger.info(f"Browser {self.name} cleaned up")

    @abstractmethod
    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Dict[str, str] = None,
        body: str = None,
        timeout: int = 30,
        **kwargs
    ) -> BrowserResult:
        """Fetch a URL and return the result."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the browser backend is healthy."""
        pass

    def __repr__(self):
        return f"<{self.__class__.__name__} type={self.browser_type.value}>"
