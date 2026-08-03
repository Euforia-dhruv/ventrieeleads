"""Celery tasks for modules 1,4,5,6,8,9,10,11."""
import logging
from celery import shared_task
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ─── Module 4: Client Readiness Batch Computation ─────────────────────────

@shared_task(name='worker.tasks.modules.compute_all_readiness_scores', bind=True,
             soft_time_limit=600, time_limit=900)
def compute_all_readiness_scores(self):
    """Compute client readiness scores for all companies."""
    from worker.services.client_readiness import client_readiness_service
    count = client_readiness_service.compute_all(limit=500)
    return {"success": True, "count": count}


# ─── Module 5: Negotiation Profile Generation ──────────────────────────────

@shared_task(name='worker.tasks.modules.generate_negotiation_profiles', bind=True,
             soft_time_limit=600, time_limit=900)
def generate_negotiation_profiles(self):
    """Generate negotiation profiles for all companies with leads."""
    from worker.services.negotiation import negotiation_service
    from worker.models.database import SessionLocal
    from worker.models import Company, Lead

    session = SessionLocal()
    try:
        companies = session.query(Company).filter(Company.is_deleted == False).all()
        count = 0
        for c in companies:
            has_lead = session.query(Lead).filter(
                Lead.company_id == c.id, Lead.is_deleted == False
            ).first()
            if has_lead:
                try:
                    negotiation_service.generate_profile(str(c.id))
                    count += 1
                except Exception as e:
                    logger.warning(f"Failed to generate negotiation profile for {c.id}: {e}")
        return {"success": True, "count": count}
    finally:
        session.close()


# ─── Module 9: Nightly Improvement Report ──────────────────────────────────

@shared_task(name='worker.tasks.modules.nightly_improvement_report', bind=True,
             soft_time_limit=300, time_limit=600)
def nightly_improvement_report(self):
    """Generate nightly autonomous improvement report."""
    from worker.services.pipeline_learning_automation import improvement_service
    result = improvement_service.generate_nightly_report()
    return {"success": True, **result}


# ─── Module 10: Morning Executive Briefing ─────────────────────────────────

@shared_task(name='worker.tasks.modules.morning_executive_briefing', bind=True,
             soft_time_limit=300, time_limit=600)
def morning_executive_briefing(self):
    """Generate morning executive operating system briefing."""
    from worker.services.pipeline_learning_automation import pipeline_service, observability_service
    from worker.services.client_readiness import client_readiness_service
    from worker.services.intelligence import intelligence_service
    from worker.models.database import SessionLocal
    from worker.models import ExecutiveAiReport
    from datetime import date

    session = SessionLocal()
    try:
        pipeline = pipeline_service.get_pipeline_stats()
        pipeline_overview = pipeline_service.get_pipeline_overview()
        top_prospects = client_readiness_service.get_top_prospects(limit=10)
        discovery = intelligence_service.get_discovery_intelligence()
        economics = intelligence_service.get_economics_data()
        overview = observability_service.get_system_overview()

        summary_parts = []
        summary_parts.append(f"Pipeline: {pipeline['active']} active opportunities worth ${pipeline['total_pipeline_value']:,}")
        summary_parts.append(f"Win rate: {pipeline['win_rate']}%")
        summary_parts.append(f"Top prospect: {top_prospects[0]['company_name'] if top_prospects else 'None'}")
        summary_parts.append(f"Companies: {discovery['summary']['total_companies']}")
        summary_parts.append(f"This week: {discovery['trends']['new_this_week']} new")

        now = datetime.now(timezone.utc)
        report = ExecutiveAiReport(
            report_date=now,
            report_type="morning_briefing",
            title=f"Morning Executive Briefing — {now.strftime('%B %d, %Y')}",
            summary=". ".join(summary_parts),
            content={
                "pipeline": pipeline_overview,
                "top_prospects": top_prospects,
                "discovery": discovery,
                "economics": economics,
                "system": overview,
            },
            recommendations=[
                {"title": f"Contact {p['company_name']}", "reason": p.get('recommended_action', ''),
                 "value": p.get('overall_readiness', 0)}
                for p in top_prospects[:5]
            ],
            top_opportunities=top_prospects,
            top_cities=discovery.get("trends", {}),
            top_industries=[],
            system_health=overview.get("last_24h", {}),
            economics=economics.get("totals", {}),
        )
        session.add(report)
        session.commit()

        return {"success": True, "report_id": str(report.id), "title": report.title}
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to generate morning briefing: {e}")
        return {"success": False, "error": str(e)}
    finally:
        session.close()


# ─── Module 11: System Metrics Collection ──────────────────────────────────

@shared_task(name='worker.tasks.modules.collect_system_metrics', bind=True,
             soft_time_limit=120, time_limit=300)
def collect_system_metrics(self):
    """Collect system metrics for observability dashboard."""
    from worker.services.pipeline_learning_automation import observability_service
    from worker.models.database import SessionLocal
    from worker.models import (
        Company, Lead, CampaignJob, SearchJob,
        DiscoveryCampaign, Opportunity,
    )
    from datetime import timedelta

    session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(days=1)

        total_companies = session.query(Company).filter(Company.is_deleted == False).count()
        total_leads = session.query(Lead).filter(Lead.is_deleted == False).count()

        recent_completed = session.query(CampaignJob).filter(
            CampaignJob.created_at > day_ago, CampaignJob.status == "completed",
            CampaignJob.is_deleted == False
        ).count()
        recent_failed = session.query(CampaignJob).filter(
            CampaignJob.created_at > day_ago, CampaignJob.status == "failed",
            CampaignJob.is_deleted == False
        ).count()
        recent_queued = session.query(CampaignJob).filter(
            CampaignJob.status == "queued", CampaignJob.is_deleted == False
        ).count()

        total_opps = session.query(Opportunity).count()

        observability_service.record_metric("data", "total_companies", total_companies, "count")
        observability_service.record_metric("data", "total_leads", total_leads, "count")
        observability_service.record_metric("data", "total_opportunities", total_opps, "count")
        observability_service.record_metric("pipeline", "completed_24h", recent_completed, "count")
        observability_service.record_metric("pipeline", "failed_24h", recent_failed, "count")
        observability_service.record_metric("pipeline", "queued", recent_queued, "count")
        observability_service.record_metric("pipeline", "success_rate",
            round(recent_completed / max(recent_completed + recent_failed, 1) * 100, 1), "percent")

        return {"success": True, "metrics_recorded": 8}
    finally:
        session.close()
