"""Campaign Scheduler - auto-trigger due campaigns."""
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import DiscoveryCampaign

logger = logging.getLogger(__name__)


@app.task(name="worker.tasks.campaign_scheduler.check_and_run_due_campaigns")
def check_and_run_due_campaigns():
    """Periodic task: check for campaigns due to run and trigger them."""
    with get_db_context() as db:
        now = datetime.utcnow()

        due_campaigns = db.query(DiscoveryCampaign).filter(
            DiscoveryCampaign.status.in_(["active", "completed"]),
            DiscoveryCampaign.is_deleted == False,
            DiscoveryCampaign.next_run_at <= now,
        ).all()

        triggered = 0
        for campaign in due_campaigns:
            try:
                from worker.tasks.campaign_orchestrator import execute_campaign
                execute_campaign.delay(str(campaign.id))

                # Schedule next run
                if campaign.cron_expression:
                    from croniter import croniter
                    cron = croniter(campaign.cron_expression, now)
                    campaign.next_run_at = cron.get_next(datetime)
                else:
                    # Default: run again in 24 hours
                    campaign.next_run_at = now + timedelta(hours=24)

                campaign.last_run_at = now
                triggered += 1
                logger.info(f"Triggered campaign: {campaign.name} ({campaign.id})")

            except Exception as e:
                logger.error(f"Failed to trigger campaign {campaign.id}: {e}")

        db.commit()
        logger.info(f"Checked {len(due_campaigns)} campaigns, triggered {triggered}")
        return {"checked": len(due_campaigns), "triggered": triggered}


@app.task(name="worker.tasks.campaign_scheduler.auto_discover_unexplored")
def auto_discover_unexplored():
    """Auto-pilot: create campaigns for unexplored high-potential cities."""
    with get_db_context() as db:
        from worker.models import Location, Industry, CampaignJob
        from sqlalchemy import func

        # Find cities with no completed campaigns
        explored_city_ids = [
            row[0] for row in db.query(CampaignJob.location_id)
            .filter(CampaignJob.status == "completed", CampaignJob.is_deleted == False)
            .distinct().all()
        ]

        unexplored_cities = db.query(Location).filter(
            Location.location_type == "city",
            Location.is_active == True,
            Location.is_deleted == False,
            ~Location.id.in_(explored_city_ids) if explored_city_ids else True,
        ).limit(10).all()

        if not unexplored_cities:
            return {"created": 0}

        # Get top industries
        top_industries = db.query(Industry).filter(
            Industry.is_active == True,
            Industry.is_deleted == False,
            Industry.parent_id.isnot(None),
        ).limit(5).all()

        if not top_industries:
            return {"created": 0}

        # Create a campaign for the first unexplored city
        city = unexplored_cities[0]
        campaign = DiscoveryCampaign(
            name=f"Auto: {city.name} discovery",
            status="active",
            city_ids=[city.id],
            industry_ids=[i.id for i in top_industries[:3]],
            max_businesses_per_city=25,
            concurrency=3,
            schedule_type="once",
        )
        db.add(campaign)
        db.commit()

        from worker.tasks.campaign_orchestrator import execute_campaign
        execute_campaign.delay(str(campaign.id))

        logger.info(f"Auto-created campaign for {city.name}")
        return {"created": 1, "city": city.name}
