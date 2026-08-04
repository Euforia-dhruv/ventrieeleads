"""Discovery task - unified multi-source lead discovery pipeline."""
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import SearchJob, Company, JobStatus
from worker.services.discovery_pipeline import DiscoveryPipeline, PipelineConfig

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.discovery.run_pipeline")
def run_pipeline(self, job_id: str):
    """
    Run the full discovery pipeline for a search job.
    Pipeline: search → dedup → scrape → audit → research → score
    """
    logger.info(f"Starting discovery pipeline for job: {job_id}")

    with get_db_context() as db:
        job = db.query(SearchJob).filter(SearchJob.id == job_id).first()
        if not job:
            logger.error(f"Job not found: {job_id}")
            return

        job.status = JobStatus.RUNNING.value
        job.celery_task_id = self.request.id
        job.started_at = datetime.utcnow()
        db.commit()

        try:
            config = PipelineConfig(
                query=job.query or "",
                industry=job.industry or "",
                location=f"{job.area or ''} {job.city or ''} {job.country or ''}".strip(),
                city=job.city or "",
                country=job.country or "",
                area=job.area or "",
                providers=[(job.extra_data or {}).get("provider", "all")],
                max_results=job.max_results or 50,
                min_rating=job.min_rating or 0,
                min_reviews=job.min_reviews or 0,
                enable_scraping=True,
                enable_audit=True,
                enable_research=True,
                enable_scoring=True,
            )

            pipeline = DiscoveryPipeline()
            import asyncio
            result = asyncio.run(pipeline.run(config))

            job.progress = 50
            db.commit()

            # Store results
            stored_count = 0
            for lead in result.leads:
                existing = db.query(Company).filter(
                    Company.name == lead.name,
                    Company.is_deleted == False
                ).first()

                if not existing:
                    company = Company(
                        name=lead.name,
                        website=lead.website or "",
                        industry=lead.industry or "",
                        city=job.city or lead.city or "",
                        area=job.area or lead.area or "",
                        country=job.country or lead.country or "",
                        address=lead.address or "",
                        phone=lead.phone or "",
                        email=lead.email or "",
                        rating=lead.rating or 0,
                        review_count=lead.review_count or 0,
                        opening_hours=lead.opening_hours or {},
                        latitude=lead.latitude or 0,
                        longitude=lead.longitude or 0,
                        google_maps_url=lead.google_maps_url or "",
                        logo_url=lead.logo_url or "",
                        source=lead.source or "pipeline",
                        provider_slug=lead.source or "pipeline",
                        provider_raw_data=lead.raw_data or {},
                        extra_data={
                            **(lead.metadata or {}),
                            "lead_score": lead.metadata.get("lead_score", 0),
                            "lead_grade": lead.metadata.get("lead_grade", "F"),
                        },
                    )
                    db.add(company)
                    db.flush()
                    stored_count += 1

            job.progress = 100
            job.results_count = stored_count
            job.status = JobStatus.COMPLETED.value
            job.completed_at = datetime.utcnow()
            db.commit()

            logger.info(
                f"Discovery pipeline {job_id} completed: "
                f"{result.total_discovered} discovered → "
                f"{result.after_dedup} deduped → "
                f"{stored_count} stored"
            )

        except Exception as e:
            logger.error(f"Discovery pipeline {job_id} failed: {e}")
            job.status = JobStatus.FAILED.value
            job.error_message = str(e)[:1000]
            job.completed_at = datetime.utcnow()
            db.commit()
            raise
