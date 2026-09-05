"""Scrapy pipelines for enriching and storing scraped business data."""
import logging
import asyncio

logger = logging.getLogger(__name__)


class LeadEnrichmentPipeline:
    """Enrich scraped items with AI extraction and email verification."""

    def open_spider(self, spider):
        self.loop = asyncio.new_event_loop()

    def close_spider(self, spider):
        self.loop.close()

    def process_item(self, item, spider):
        """Enrich item with AI scraping and email verification."""
        url = item.get("url", "")
        if not url:
            return item

        try:
            from worker.services.ai_scraper import ai_scraper
            from worker.services.email_verifier import email_verifier

            # AI enrichment
            ai_data = self.loop.run_until_complete(
                ai_scraper.extract_contacts(url)
            )
            if ai_data:
                if ai_data.get("emails"):
                    item["email"] = ai_data["emails"][0] if ai_data["emails"] else item.get("email", "")
                if ai_data.get("phones"):
                    item["phone"] = ai_data["phones"][0] if ai_data["phones"] else item.get("phone", "")
                if ai_data.get("description"):
                    item["description"] = ai_data["description"]
                if ai_data.get("social_links"):
                    item["social_links"] = ai_data["social_links"]

            # Email verification
            email = item.get("email", "")
            if email:
                verified = self.loop.run_until_complete(
                    email_verifier.verify(email)
                )
                item["email_verified"] = verified.get("is_valid", False)
                item["email_score"] = verified.get("score", 0)

        except Exception as e:
            logger.debug(f"Enrichment failed for {url}: {e}")

        return item
