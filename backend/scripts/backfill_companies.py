"""Backfill script — enrich existing companies with missing data (phone, website, reviews)."""
import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)


def backfill_companies():
    """Find companies with missing data and re-scrape their detail pages."""
    from worker.models.database import get_db_context
    from worker.models import Company

    with get_db_context() as db:
        # Find companies with coordinates but missing phone/website
        companies = db.query(Company).filter(
            Company.is_deleted == False,
            Company.latitude > 0,
            Company.google_maps_url != "",
            Company.google_maps_url.isnot(None),
        ).all()

        needs_enrichment = []
        for c in companies:
            if not c.phone or not c.website or not c.review_count:
                needs_enrichment.append(c)

        logger.info(f"Found {len(needs_enrichment)} companies needing enrichment (out of {len(companies)} with coords)")

        if not needs_enrichment:
            return

        # Process in batches
        from worker.scrapers.google_maps import google_maps_scraper

        async def enrich_batch(companies_batch):
            try:
                from playwright.async_api import async_playwright
            except ImportError:
                logger.error("Playwright not installed")
                return

            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                    ]
                )
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent=google_maps_scraper.USER_AGENT,
                    locale="en-US",
                )
                await context.add_init_script(google_maps_scraper.STEALTH_JS)

                enriched = 0
                for company in companies_batch:
                    if not company.google_maps_url:
                        continue
                    try:
                        details = await google_maps_scraper._get_details(context, company.google_maps_url)
                        if details:
                            if details.get("phone") and not company.phone:
                                company.phone = details["phone"]
                                enriched += 1
                            if details.get("website") and not company.website:
                                company.website = details["website"]
                                enriched += 1
                            if details.get("address") and not company.address:
                                company.address = details["address"]
                            if details.get("review_count") and not company.review_count:
                                company.review_count = details["review_count"]
                            if details.get("latitude") and (not company.latitude or company.latitude == 0):
                                company.latitude = details["latitude"]
                                company.longitude = details["longitude"]
                    except Exception as e:
                        logger.debug(f"Failed to enrich {company.name}: {e}")

                await browser.close()
                return enriched

        # Process in batches of 20
        batch_size = 20
        total_enriched = 0
        for i in range(0, len(needs_enrichment), batch_size):
            batch = needs_enrichment[i:i + batch_size]
            logger.info(f"Processing batch {i // batch_size + 1}/{(len(needs_enrichment) + batch_size - 1) // batch_size} ({len(batch)} companies)")
            enriched = asyncio.run(enrich_batch(batch))
            total_enriched += enriched
            db.commit()
            logger.info(f"Enriched {enriched} companies in this batch")

        logger.info(f"Total enriched: {total_enriched}")


if __name__ == "__main__":
    backfill_companies()
