"""Audit task — performs website audits after scraping is complete."""
import asyncio
import logging
import time
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import Company, Website, Audit, Technology
from worker.services.audit import audit_service
from worker.services.scoring import lead_scorer

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.audit.audit_website")
def audit_website(self, company_id_or_result, company_id: str = None):
    """Perform an audit on a company website.

    Accepts either:
      - audit_website("company-id")  (direct call)
      - audit_website(scrape_result, "company-id")  (from Celery chain)
    """
    # Handle Celery chain calling convention
    if company_id is None:
        company_id = str(company_id_or_result)

    logger.info(f"Auditing website for company: {company_id}")
    t0 = time.time()

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return {"status": "not_found", "company_id": company_id}

        website = db.query(Website).filter(Website.company_id == company_id).first()
        if not website:
            if self.request.retries < 3:
                logger.info(f"No website record yet for {company.name}, retry {self.request.retries + 1}/3")
                raise self.retry(countdown=15, max_retries=3)
            logger.warning(f"No website record after retries: {company.name}")
            return {"status": "no_website", "company_id": company_id}

        try:
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

            # Recalculate lead score with audit data
            social_count = sum(1 for s in [website.instagram, website.facebook, website.linkedin, website.youtube, website.tiktok] if s)
            tech_count = db.query(Technology).filter(Technology.company_id == company_id).count()

            # Get audit issues as strings for scoring
            audit_issues = audit.issues or []
            if audit_issues and isinstance(audit_issues[0], dict):
                audit_issues = [i.get("title", str(i)) for i in audit_issues]

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
                industry=company.industry or "",
                audit_issues=audit_issues,
            )

            from worker.models import Lead, Workspace
            workspace = db.query(Workspace).first()
            if workspace:
                lead = db.query(Lead).filter(
                    Lead.workspace_id == workspace.id,
                    Lead.company_id == company_id
                ).first()
                if lead:
                    lead.score = score_result["score"]
                    lead.score_label = score_result["label"]

            db.commit()

            elapsed = round(time.time() - t0, 1)
            logger.info(f"Audit completed for {company.name}: overall={audit.overall_score} ({elapsed}s)")

            return {
                "status": "completed",
                "company_id": company_id,
                "overall_score": audit.overall_score,
                "lead_score": score_result["score"],
            }

        except Exception as e:
            logger.error(f"Audit failed for {company.name}: {e}")
            db.rollback()
            return {"status": "failed", "company_id": company_id, "error": str(e)[:200]}
