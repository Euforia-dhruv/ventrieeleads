"""Scrapers for lead generation."""
from worker.scrapers.google_maps import google_maps_scraper, GoogleMapsScraper
from worker.scrapers.website import website_scraper, WebsiteScraper
from worker.scrapers.tech_detector import tech_detector, TechDetector
from worker.scrapers.screenshot import screenshot_service, ScreenshotService

__all__ = [
    "google_maps_scraper",
    "GoogleMapsScraper",
    "website_scraper",
    "WebsiteScraper",
    "tech_detector",
    "TechDetector",
    "screenshot_service",
    "ScreenshotService",
]
