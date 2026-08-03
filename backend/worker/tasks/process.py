"""Process task - orchestrates the full pipeline per company."""
import logging
from datetime import datetime, timedelta
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import SearchJob, Company, Lead, JobStatus

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.process.process_company")
def process_company(self, company_id: str):
    """Process a single company: scrape, then audit, then score."""
    logger.info(f"Processing company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return

        if company.website:
            self.update_state(state="PROGRESS", meta={"stage": "scraping", "progress": 20})
            try:
                from worker.tasks.scrape import scrape_company
                scrape_company.delay(str(company_id))
            except Exception as e:
                logger.error(f"Scraping dispatch failed for {company.name}: {e}")

            self.update_state(state="PROGRESS", meta={"stage": "auditing", "progress": 60})
            try:
                from worker.tasks.audit import audit_website
                audit_website.delay(str(company_id))
            except Exception as e:
                logger.error(f"Audit dispatch failed for {company.name}: {e}")
        else:
            logger.info(f"No website for {company.name}, skipping scrape/audit")

        self.update_state(state="PROGRESS", meta={"stage": "scoring", "progress": 90})
        try:
            from worker.services.scoring import lead_scorer
            from worker.models import Website, Technology, Audit

            website = db.query(Website).filter(Website.company_id == company_id).first()
            tech_count = db.query(Technology).filter(Technology.company_id == company_id).count()
            social_count = sum(1 for s in [website.instagram, website.facebook, website.linkedin, website.youtube] if s) if website else 0

            website_score = 0
            if website:
                audit = db.query(Audit).filter(Audit.website_id == website.id).first()
                if audit:
                    website_score = audit.overall_score

            score_result = lead_scorer.score(
                website_score=website_score,
                review_count=company.review_count or 0,
                rating=company.rating or 0,
                has_website=bool(company.website),
                has_email=bool(company.email),
                has_phone=bool(company.phone),
                has_whatsapp=bool(website.whatsapp) if website else False,
                tech_count=tech_count,
                social_count=social_count,
                industry=company.industry or ""
            )

            from worker.models import Workspace
            workspace = db.query(Workspace).first()
            if not workspace:
                workspace = Workspace(name="Default", slug="default")
                db.add(workspace)
                db.flush()

            lead = db.query(Lead).filter(
                Lead.workspace_id == workspace.id,
                Lead.company_id == company_id
            ).first()

            if not lead:
                lead = Lead(
                    workspace_id=workspace.id,
                    company_id=company_id,
                    status="New",
                    source="search"
                )
                db.add(lead)

            lead.score = score_result["score"]
            lead.score_label = score_result["label"]

            logger.info(f"Company {company.name} processed: score={score_result['score']} ({score_result['label']})")

        except Exception as e:
            logger.error(f"Scoring failed for {company.name}: {e}")

        self.update_state(state="PROGRESS", meta={"stage": "completed", "progress": 100})


@app.task(name="worker.tasks.process.cleanup_stale_jobs")
def cleanup_stale_jobs():
    """Clean up jobs stuck in running state for too long."""
    with get_db_context() as db:
        stale_threshold = datetime.utcnow() - timedelta(hours=1)
        stale_jobs = db.query(SearchJob).filter(
            SearchJob.status == JobStatus.RUNNING.value,
            SearchJob.started_at < stale_threshold
        ).all()

        for job in stale_jobs:
            job.status = JobStatus.FAILED.value
            job.error_message = "Job timed out after 1 hour"
            job.completed_at = datetime.utcnow()
            logger.warning(f"Cleaned up stale job: {job.id}")
