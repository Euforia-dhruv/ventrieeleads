"""Process task — orchestrates the full pipeline per company: scrape → audit → score."""
import asyncio
import logging
from datetime import datetime, timedelta
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import SearchJob, Company, Lead, JobStatus

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.process.process_company")
def process_company(self, company_id: str):
    """Process a single company: scrape → audit → score.

    Uses Celery chain to guarantee ordering:
    scrape_company → audit_website → score_lead
    """
    logger.info(f"Processing company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return

        if company.website:
            # Chain: scrape → audit → score (sequential, guaranteed order)
            try:
                from celery import chain
                from worker.tasks.scrape import scrape_company
                from worker.tasks.audit import audit_website

                workflow = chain(
                    scrape_company.s(str(company_id)),
                    audit_website.s(str(company_id)),
                )
                workflow.apply_async()
                logger.info(f"Dispatched scrape→audit chain for {company.name}")
            except Exception as e:
                logger.error(f"Chain dispatch failed for {company.name}: {e}")
                # Fallback: dispatch individually
                try:
                    from worker.tasks.scrape import scrape_company
                    scrape_company.delay(str(company_id))
                except Exception as e2:
                    logger.error(f"Scrape dispatch failed: {e2}")
                try:
                    from worker.tasks.audit import audit_website
                    audit_website.delay(str(company_id))
                except Exception as e2:
                    logger.error(f"Audit dispatch failed: {e2}")
        else:
            logger.info(f"No website for {company.name}, scoring immediately")
            _score_company(str(company_id))


def _score_company(company_id: str):
    """Score a company and create/update its lead."""
    try:
        from worker.services.scoring import lead_scorer
        from worker.models import Website, Technology, Audit, Workspace

        with get_db_context() as db:
            company = db.query(Company).filter(Company.id == company_id).first()
            if not company:
                return

            has_website = bool(company.website)

            # Get audit data if available
            website = db.query(Website).filter(Website.company_id == company_id).first()
            audit = db.query(Audit).filter(Audit.website_id == website.id).first() if website else None

            social_count = 0
            if website:
                social_count = sum(1 for s in [website.instagram, website.facebook, website.linkedin, website.youtube, website.tiktok] if s)

            tech_count = db.query(Technology).filter(Technology.company_id == company_id).count()

            # Get audit issues/strengths
            audit_issues = []
            audit_strengths = []
            audit_weaknesses = []
            if audit:
                audit_issues = audit.issues or []
                audit_strengths = audit.strengths or []
                audit_weaknesses = audit.weaknesses or []
                # Handle both string and dict issues
                if audit_issues and isinstance(audit_issues[0], dict):
                    audit_issues = [i.get("title", str(i)) for i in audit_issues]
                if audit_strengths and isinstance(audit_strengths[0], dict):
                    audit_strengths = [s.get("title", str(s)) for s in audit_strengths]
                if audit_weaknesses and isinstance(audit_weaknesses[0], dict):
                    audit_weaknesses = [w.get("title", str(w)) for w in audit_weaknesses]

            # Heuristic score first
            score_result = lead_scorer.score(
                website_score=audit.overall_score if audit else 0,
                review_count=company.review_count or 0,
                rating=company.rating or 0,
                has_website=has_website,
                has_email=bool(company.email),
                has_phone=bool(company.phone),
                has_whatsapp=bool(website.whatsapp) if website else False,
                tech_count=tech_count,
                social_count=social_count,
                industry=company.industry or "",
                audit_issues=audit_issues,
            )

            # Try AI-enhanced scoring
            try:
                import asyncio as _asyncio
                tech_names = []
                if tech_count > 0:
                    techs = db.query(Technology).filter(Technology.company_id == company_id).all()
                    tech_names = [t.name for t in techs]

                ai_result = _asyncio.run(lead_scorer.ai_score(
                    company_name=company.name,
                    industry=company.industry or "",
                    website=company.website or "",
                    website_score=audit.overall_score if audit else 0,
                    review_count=company.review_count or 0,
                    rating=company.rating or 0,
                    has_website=has_website,
                    has_email=bool(company.email),
                    has_phone=bool(company.phone),
                    has_whatsapp=bool(website.whatsapp) if website else False,
                    tech_count=tech_count,
                    social_count=social_count,
                    audit_issues=audit_issues,
                    audit_strengths=audit_strengths,
                    audit_weaknesses=audit_weaknesses,
                    tech_names=tech_names,
                    city=company.city or "",
                    country=company.country or "",
                ))
                if ai_result and ai_result.get("score", 0) > 0:
                    score_result = ai_result
            except Exception as e:
                logger.debug(f"AI scoring failed for {company.name}, using heuristic: {e}")

            # Create or update lead
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
                    source="search",
                )
                db.add(lead)
                db.flush()

                # Associate with first pipeline stage
                try:
                    from worker.models import LeadPipeline, PipelineStage, PipelineEvent
                    stage = db.query(PipelineStage).filter(
                        PipelineStage.is_active == True
                    ).order_by(PipelineStage.sort_order.asc()).first()
                    if stage:
                        entry = LeadPipeline(
                            lead_id=lead.id,
                            company_id=company_id,
                            stage_id=stage.id,
                        )
                        db.add(entry)
                        db.flush()
                        db.add(PipelineEvent(
                            lead_id=lead.id,
                            pipeline_id=entry.id,
                            from_stage_id=None,
                            to_stage_id=stage.id,
                            confidence=0.5,
                        ))
                except Exception as e:
                    logger.warning(f"Pipeline association failed for {company.name}: {e}")

            lead.score = score_result.get("score", 0)
            lead.score_label = score_result.get("label", "cold")

            # Store AI enrichment data in extra_data
            extra = lead.extra_data or {}
            if score_result.get("ai_enhanced"):
                extra["ai_scoring"] = {
                    "opportunity_score": score_result.get("opportunity_score", 0),
                    "urgency": score_result.get("urgency", "medium"),
                    "buying_probability": score_result.get("buying_probability", 0),
                    "estimated_project_value": score_result.get("estimated_project_value", ""),
                    "recommended_service": score_result.get("recommended_service", ""),
                    "pain_points": score_result.get("pain_points", []),
                    "reasons": score_result.get("reasons", []),
                    "outreach_angle": score_result.get("outreach_angle", ""),
                }
            extra["sub_scores"] = {
                "website_quality": score_result.get("website_quality", 0),
                "contact_score": score_result.get("contact_score", 0),
                "tech_presence": score_result.get("tech_presence", 0),
                "reputation": score_result.get("reputation", 0),
                "opportunity_score": score_result.get("opportunity_score", 0),
            }
            lead.extra_data = extra

            logger.info(f"Scored {company.name}: {lead.score} ({lead.score_label})")

    except Exception as e:
        logger.error(f"Scoring failed for {company_id}: {e}")


def _enrich_with_providers(company_id: str) -> None:
    """Enrich a company using available providers."""
    try:
        from worker.providers.registry import registry
        from worker.models import Company

        with get_db_context() as db:
            company = db.query(Company).filter(Company.id == company_id).first()
            if not company:
                return

            from worker.providers.base import NormalizedLead
            lead = NormalizedLead(
                name=company.name,
                source=company.source or "unknown",
                website=company.website or "",
                phone=company.phone or "",
                email=company.email or "",
                address=company.address or "",
                city=company.city or "",
                country=company.country or "",
                industry=company.industry or "",
                rating=company.rating or 0,
                review_count=company.review_count or 0,
                logo_url=company.logo_url or "",
                latitude=company.latitude or 0,
                longitude=company.longitude or 0,
                google_maps_url=company.google_maps_url or "",
            )

            enriched = asyncio.run(registry.enrich_lead(lead))

            if enriched.email and not company.email:
                company.email = enriched.email
            if enriched.phone and not company.phone:
                company.phone = enriched.phone
            if enriched.logo_url and not company.logo_url:
                company.logo_url = enriched.logo_url
            if enriched.description:
                extra = company.extra_data or {}
                extra["enriched_description"] = enriched.description
                company.extra_data = extra

            existing_socials = company.extra_data or {}
            if enriched.social_links:
                existing_socials.update(enriched.social_links)
                company.extra_data = existing_socials

            db.commit()
            logger.info(f"Enriched {company.name}: email={enriched.email}, phone={enriched.phone}")

    except Exception as e:
        logger.error(f"Provider enrichment failed for {company_id}: {e}")


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
