"""Audit task - performs website audits."""
import logging
import time
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import Company, Website, Audit, Technology
from worker.services.audit import audit_service
from worker.services.scoring import lead_scorer

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.audit.audit_website")
def audit_website(self, company_id: str):
    """Perform an audit on a company website."""
    logger.info(f"Auditing website for company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return

        website = db.query(Website).filter(Website.company_id == company_id).first()
        if not website:
            if self.request.retries < 5:
                logger.info(f"No website record yet for {company.name}, retrying in 10s (attempt {self.request.retries + 1}/5)")
                raise self.retry(countdown=10, max_retries=5)
            logger.warning(f"No website record for company after retries: {company_id}")
            return

        try:
            import asyncio
            audit_data = asyncio.run(audit_service.perform_audit(website.url))

            audit = db.query(Audit).filter(Audit.website_id == website.id).first()
            if not audit:
                audit = Audit(website_id=website.id)
                db.add(audit)

            audit.website_score = audit_data.get("website_score", 0)
            audit.seo_score = audit_data.get("seo_score", 0)
            audit.performance_score = audit_data.get("performance_score", 0)
            audit.accessibility_score = audit_data.get("accessibility_score", 0)
            audit.design_score = audit_data.get("design_score", 0)
            audit.branding_score = audit_data.get("branding_score", 0)
            audit.conversion_score = audit_data.get("conversion_score", 0)
            audit.copywriting_score = audit_data.get("copywriting_score", 0)
            audit.trust_score = audit_data.get("trust_score", 0)
            audit.overall_score = audit_data.get("overall_score", 0)
            audit.checks = audit_data.get("checks", {})
            audit.issues = audit_data.get("issues", [])
            audit.strengths = audit_data.get("strengths", [])
            audit.weaknesses = audit_data.get("weaknesses", [])
            audit.quick_wins = audit_data.get("quick_wins", [])
            audit.estimated_redesign_budget = audit_data.get("estimated_redesign_budget", "")
            audit.recommended_services = audit_data.get("recommended_services", [])
            audit.raw_data = audit_data.get("raw_data", {})

            db.flush()

            social_count = sum(1 for s in [website.instagram, website.facebook, website.linkedin, website.youtube] if s)
            tech_count = db.query(Technology).filter(Technology.company_id == company_id).count()

            score_result = lead_scorer.score(
                website_score=audit.overall_score,
                review_count=company.review_count,
                rating=company.rating,
                has_website=True,
                has_email=bool(company.email),
                has_phone=bool(company.phone),
                has_whatsapp=bool(website.whatsapp),
                tech_count=tech_count,
                social_count=social_count,
                industry=company.industry or ""
            )

            from worker.models import Lead
            lead = db.query(Lead).filter(Lead.company_id == company_id).first()
            if lead:
                lead.score = score_result["score"]
                lead.score_label = score_result["label"]

            logger.info(f"Audit completed for {company.name}: overall={audit.overall_score}")

        except Exception as e:
            logger.error(f"Audit failed for {company.name}: {e}")
            db.rollback()
            raise
