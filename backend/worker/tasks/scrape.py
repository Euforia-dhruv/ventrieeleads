"""Scrape task - extracts data from company websites."""
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import Company, Website, Contact, Technology, JobStatus
from worker.scrapers.website import website_scraper
from worker.scrapers.tech_detector import tech_detector
from worker.scrapers.screenshot import screenshot_service

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.scrape.scrape_company")
def scrape_company(self, company_id: str):
    """Scrape a company website for details."""
    logger.info(f"Scraping company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company or not company.website:
            logger.warning(f"Company not found or no website: {company_id}")
            return

        try:
            import asyncio

            website_data = asyncio.run(website_scraper.scrape(company.website))
            logger.info(f"Website scraped for {company.name}")

            website = db.query(Website).filter(
                Website.company_id == company_id
            ).first()

            if not website:
                website = Website(company_id=company_id, url=company.website)
                db.add(website)

            website.title = website_data.get("title", "")
            website.description = website_data.get("description", "")
            website.logo_url = website_data.get("logo_url", "")
            website.emails = website_data.get("emails", [])
            website.phone_numbers = website_data.get("phone_numbers", [])
            website.whatsapp = website_data.get("whatsapp", "")
            website.instagram = website_data.get("instagram", "")
            website.facebook = website_data.get("facebook", "")
            website.linkedin = website_data.get("linkedin", "")
            website.youtube = website_data.get("youtube", "")
            website.contact_page = website_data.get("contact_page", "")
            website.about_page = website_data.get("about_page", "")
            website.services = website_data.get("services", [])
            website.last_crawled = datetime.utcnow()

            if not company.email and website.emails:
                company.email = website.emails[0]
            if not company.phone and website.phone_numbers:
                company.phone = website.phone_numbers[0]
            if not company.logo_url and website.logo_url:
                company.logo_url = website.logo_url

            if website.emails:
                for email in website.emails[:5]:
                    existing = db.query(Contact).filter(
                        Contact.company_id == company_id,
                        Contact.email == email
                    ).first()
                    if not existing:
                        db.add(Contact(company_id=company_id, email=email, is_primary=(email == website.emails[0])))

            db.flush()
            self.update_state(state="PROGRESS", meta={"stage": "tech_detection", "progress": 50})

            techs = asyncio.run(tech_detector.detect(company.website))
            for tech in techs:
                existing = db.query(Technology).filter(
                    Technology.company_id == company_id,
                    Technology.name == tech["name"]
                ).first()
                if not existing:
                    db.add(Technology(
                        company_id=company_id,
                        name=tech["name"],
                        category=tech.get("category", ""),
                        confidence=tech.get("confidence", 1.0)
                    ))

            db.flush()
            self.update_state(state="PROGRESS", meta={"stage": "screenshots", "progress": 75})

            screenshots = asyncio.run(
                screenshot_service.capture(
                    url=company.website,
                    company_id=str(company_id),
                    desktop=True,
                    mobile=True,
                    full_page=True
                )
            )

            if screenshots.get("desktop"):
                company.screenshot_url = screenshots["desktop"]
            if screenshots.get("mobile"):
                website.extra_data = {**(website.extra_data or {}), "mobile_screenshot": screenshots["mobile"]}

            db.commit()
            logger.info(f"Scraping completed for {company.name}")

        except Exception as e:
            logger.error(f"Scraping failed for {company.name}: {e}")
            db.rollback()
            raise
