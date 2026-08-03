"""Monitor task - periodic website monitoring and change detection."""
import asyncio
import logging
from datetime import datetime, timedelta
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import Company, Website, Audit, Technology, MonitoringSchedule, MonitoringSnapshot, Notification

logger = logging.getLogger(__name__)


@app.task(name="worker.tasks.monitor.run_scheduled_checks")
def run_scheduled_checks():
    """Check for companies that need monitoring."""
    with get_db_context() as db:
        now = datetime.utcnow()
        schedules = db.query(MonitoringSchedule).filter(
            MonitoringSchedule.is_active == True,
            MonitoringSchedule.is_deleted == False,
            MonitoringSchedule.next_check_at <= now,
        ).all()

        logger.info(f"Found {len(schedules)} monitoring schedules to run")

        for schedule in schedules:
            try:
                check_company.delay(str(schedule.company_id), str(schedule.id))
                schedule.last_check_at = now
                schedule.next_check_at = now + timedelta(hours=schedule.check_interval_hours or 24)
            except Exception as e:
                logger.error(f"Failed to enqueue monitoring for {schedule.company_id}: {e}")

        db.commit()


@app.task(bind=True, name="worker.tasks.monitor.check_company")
def check_company(self, company_id: str, schedule_id: str = None):
    """Perform a monitoring check on a single company."""
    logger.info(f"Monitoring check for company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            return

        website = db.query(Website).filter(Website.company_id == company_id).first()
        audit = None
        if website:
            audit = db.query(Audit).filter(Audit.website_id == website.id).first()

        old_snapshot = db.query(MonitoringSnapshot).filter(
            MonitoringSnapshot.company_id == company_id
        ).order_by(MonitoringSnapshot.created_at.desc()).first()

        new_overall = audit.overall_score if audit else None
        new_seo = audit.seo_score if audit else None
        new_perf = audit.performance_score if audit else None

        techs = db.query(Technology).filter(Technology.company_id == company_id).all()
        new_techs = sorted([t.name for t in techs])

        changes = []

        if old_snapshot and new_overall is not None:
            if old_snapshot.overall_score and abs((new_overall or 0) - old_snapshot.overall_score) > 3:
                changes.append({
                    "type": "score_change",
                    "field": "overall_score",
                    "old": old_snapshot.overall_score,
                    "new": new_overall,
                })

            if old_snapshot.seo_score and new_seo and abs(new_seo - old_snapshot.seo_score) > 3:
                changes.append({
                    "type": "score_change",
                    "field": "seo_score",
                    "old": old_snapshot.seo_score,
                    "new": new_seo,
                })

            old_techs = sorted(old_snapshot.snapshot_data.get("technologies", []) if old_snapshot.snapshot_data else [])
            if old_techs != new_techs:
                added = set(new_techs) - set(old_techs)
                removed = set(old_techs) - set(new_techs)
                if added or removed:
                    changes.append({
                        "type": "technology_change",
                        "added": list(added),
                        "removed": list(removed),
                    })

            if company.review_count and old_snapshot.review_count:
                review_diff = company.review_count - old_snapshot.review_count
                if abs(review_diff) > 5:
                    changes.append({
                        "type": "review_change",
                        "old": old_snapshot.review_count,
                        "new": company.review_count,
                        "delta": review_diff,
                    })

        snapshot = MonitoringSnapshot(
            schedule_id=schedule_id or "",
            company_id=company_id,
            overall_score=new_overall,
            seo_score=new_seo,
            performance_score=new_perf,
            technology_stack=new_techs,
            review_count=company.review_count,
            rating=company.rating,
            changes_detected=changes,
            snapshot_data={
                "technologies": new_techs,
                "website": company.website,
            }
        )
        db.add(snapshot)

        if changes:
            try:
                notification = Notification(
                    type="monitoring_change",
                    title=f"Changes detected: {company.name}",
                    message=f"Detected {len(changes)} change(s) for {company.name}",
                    entity_type="company",
                    entity_id=company_id,
                    is_read=False,
                )
                db.add(notification)
                logger.info(f"Changes detected for {company.name}: {len(changes)} changes")
            except Exception as e:
                logger.error(f"Failed to create notification: {e}")

        company.is_monitored = True
        company.last_monitored_at = datetime.utcnow()
        db.commit()

        logger.info(f"Monitoring check completed for {company.name}: {len(changes)} changes detected")


@app.task(name="worker.tasks.monitor.start_monitoring")
def start_monitoring(company_id: str, interval_hours: int = 24):
    """Start monitoring a company."""
    with get_db_context() as db:
        existing = db.query(MonitoringSchedule).filter(
            MonitoringSchedule.company_id == company_id,
            MonitoringSchedule.is_active == True,
            MonitoringSchedule.is_deleted == False,
        ).first()

        if existing:
            existing.check_interval_hours = interval_hours
            existing.next_check_at = datetime.utcnow() + timedelta(hours=interval_hours)
        else:
            schedule = MonitoringSchedule(
                company_id=company_id,
                check_interval_hours=interval_hours,
                next_check_at=datetime.utcnow() + timedelta(hours=interval_hours),
                is_active=True,
            )
            db.add(schedule)

        db.commit()
        logger.info(f"Started monitoring for company {company_id} every {interval_hours}h")
