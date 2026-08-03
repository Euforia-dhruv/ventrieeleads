"""Utility functions for the worker service."""
import os
import logging
from typing import Optional

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def setup_logging():
    """Configure logging for the worker."""
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
        ]
    )
    return logging.getLogger(__name__)


def get_env(key: str, default: Optional[str] = None) -> str:
    """Get environment variable with default."""
    return os.getenv(key, default or "")


def get_env_int(key: str, default: int = 0) -> int:
    """Get environment variable as integer."""
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def get_env_bool(key: str, default: bool = False) -> bool:
    """Get environment variable as boolean."""
    val = os.getenv(key, str(default)).lower()
    return val in ("true", "1", "yes", "on")
