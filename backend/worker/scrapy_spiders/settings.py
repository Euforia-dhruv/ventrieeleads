"""Scrapy settings for leads project."""
import os

BOT_NAME = "leads_spider"
SPIDER_MODULES = ["worker.scrapy_spiders"]
NEWSPIDER_MODULE = "worker.scrapy_spiders"

# Redis-based distributed crawling
SCHEDULER = "scrapy_redis.scheduler.Scheduler"
DUPEFILTER_CLASS = "scrapy_redis.dupefilter.RFPDupeFilter"
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Respect robots.txt
ROBOTSTXT_OBEY = True

# Concurrent requests
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 4
DOWNLOAD_DELAY = 2

# Retry
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Timeout
DOWNLOAD_TIMEOUT = 20

# User agent
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Autothrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Pipeline - store scraped items in Redis for processing
ITEM_PIPELINES = {
    "worker.scrapy_spiders.pipelines.LeadEnrichmentPipeline": 300,
}
