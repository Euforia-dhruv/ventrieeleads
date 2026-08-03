"""Campaign Orchestrator - generates and manages discovery jobs from campaigns."""
import logging
from datetime import datetime
from typing import List, Dict
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import (
    DiscoveryCampaign, CampaignJob, SearchJob,
    Location, Industry, JobStatus,
)

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.campaign_orchestrator.execute_campaign")
def execute_campaign(self, campaign_id: str):
    """
    Main campaign orchestrator.
    Resolves locations x industries x providers and generates discovery jobs.
    """
    logger.info(f"Executing campaign: {campaign_id}")

    with get_db_context() as db:
        campaign = db.query(DiscoveryCampaign).filter(
            DiscoveryCampaign.id == campaign_id,
            DiscoveryCampaign.is_deleted == False,
        ).first()

        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            return {"error": "Campaign not found"}

        campaign.status = "running"
        campaign.last_run_at = datetime.utcnow()
        db.commit()

        try:
            locations = _resolve_locations(db, campaign)
            industries = _resolve_industries(db, campaign)
            providers = _resolve_providers(campaign)

            logger.info(
                f"Campaign '{campaign.name}': "
                f"{len(locations)} locations x {len(industries)} industries x "
                f"{len(providers)} providers = "
                f"{len(locations) * len(industries) * len(providers)} potential jobs"
            )

            from worker.services.discovery_optimizer import discovery_optimizer

            generated = 0
            skipped = 0

            for loc in locations:
                for ind in industries:
                    for prov in providers:
                        should_skip, existing_id, reason = (
                            discovery_optimizer.should_skip(
                                str(loc["id"]), str(_get_industry_id(ind)), prov
                            )
                        )

                        if should_skip:
                            _create_campaign_job(
                                db, campaign, loc, ind, prov,
                                status="skipped", error_message=reason,
                            )
                            skipped += 1
                            continue

                        cj = _create_campaign_job(
                            db, campaign, loc, ind, prov, status="queued"
                        )
                        search_job = _create_search_job(db, cj, loc, ind, prov, campaign)
                        cj.search_job_id = search_job.id
                        generated += 1

            campaign.total_jobs = generated + skipped
            campaign.queued_jobs = generated
            campaign.skipped_jobs = skipped
            campaign.status = "active"
            db.commit()

            _dispatch_jobs(campaign_id, campaign.concurrency)

            logger.info(
                f"Campaign '{campaign.name}': {generated} jobs generated, {skipped} skipped"
            )

            return {
                "campaign_id": campaign_id,
                "generated": generated,
                "skipped": skipped,
                "locations": len(locations),
                "industries": len(industries),
                "providers": len(providers),
            }

        except Exception as e:
            campaign.status = "failed"
            db.commit()
            logger.error(f"Campaign '{campaign.name}' failed: {e}")
            raise


def _get_industry_id(ind: Dict) -> str:
    return str(ind.get("id", ""))


def _resolve_locations(db, campaign) -> List[Dict]:
    """Resolve campaign location selections into concrete city-level locations."""
    locations = []

    if campaign.city_ids:
        for city_id in campaign.city_ids:
            city = db.query(Location).filter(
                Location.id == city_id, Location.is_deleted == False
            ).first()
            if not city:
                continue
            state, country = _get_parent_info(db, city)
            locations.append(_make_loc(city, state, country))

    elif campaign.state_ids:
        for state_id in campaign.state_ids:
            state = db.query(Location).filter(
                Location.id == state_id, Location.is_deleted == False
            ).first()
            if not state:
                continue
            country = (
                db.query(Location).filter(Location.id == state.parent_id).first()
                if state.parent_id
                else None
            )
            cities = db.query(Location).filter(
                Location.parent_id == state_id,
                Location.location_type == "city",
                Location.is_deleted == False,
            ).all()
            if cities:
                for city in cities:
                    locations.append(_make_loc(city, state, country))
            else:
                locations.append(_make_loc(state, None, country))

    elif campaign.country_ids:
        for country_id in campaign.country_ids:
            country = db.query(Location).filter(
                Location.id == country_id, Location.is_deleted == False
            ).first()
            if not country:
                continue
            cities = db.query(Location).filter(
                Location.country_code == country.country_code,
                Location.location_type == "city",
                Location.is_deleted == False,
            ).all()
            if cities:
                for city in cities:
                    state = (
                        db.query(Location).filter(Location.id == city.parent_id).first()
                        if city.parent_id
                        else None
                    )
                    locations.append(_make_loc(city, state, country))
            else:
                locations.append(_make_loc(country, None, None))
    else:
        cities = db.query(Location).filter(
            Location.location_type == "city",
            Location.is_deleted == False,
            Location.is_active == True,
        ).all()
        for city in cities:
            state, country = _get_parent_info(db, city)
            locations.append(_make_loc(city, state, country))

    return locations


def _get_parent_info(db, location):
    state = (
        db.query(Location).filter(Location.id == location.parent_id).first()
        if location.parent_id
        else None
    )
    country = (
        db.query(Location).filter(Location.id == state.parent_id).first()
        if state and state.parent_id
        else None
    )
    return state, country


def _make_loc(city, state, country) -> Dict:
    return {
        "id": city.id,
        "name": city.name,
        "country_code": city.country_code or (country.country_code if country else ""),
        "state_name": state.name if state else "",
        "city_name": city.name,
    }


def _resolve_industries(db, campaign) -> List[Dict]:
    """Resolve campaign industry selections into leaf industries."""
    industries = []

    if campaign.industry_ids:
        for ind_id in campaign.industry_ids:
            ind = db.query(Industry).filter(
                Industry.id == ind_id, Industry.is_deleted == False
            ).first()
            if not ind:
                continue
            children = db.query(Industry).filter(
                Industry.parent_id == ind_id, Industry.is_deleted == False
            ).all()
            if children:
                for child in children:
                    industries.append({
                        "id": child.id, "name": child.name, "slug": child.slug,
                    })
            else:
                industries.append({
                    "id": ind.id, "name": ind.name, "slug": ind.slug,
                })
    else:
        all_inds = db.query(Industry).filter(
            Industry.is_deleted == False, Industry.is_active == True
        ).all()
        for ind in all_inds:
            has_children = db.query(Industry).filter(
                Industry.parent_id == ind.id, Industry.is_deleted == False
            ).count() > 0
            if not has_children:
                industries.append({
                    "id": ind.id, "name": ind.name, "slug": ind.slug,
                })

    return industries


def _resolve_providers(campaign) -> List[str]:
    if campaign.provider_slugs:
        return list(campaign.provider_slugs)
    from worker.providers.registry import registry
    return registry.list_enabled_slugs()


def _create_campaign_job(
    db, campaign, loc, ind, prov, status="queued", error_message=None
) -> CampaignJob:
    cj = CampaignJob(
        campaign_id=campaign.id,
        location_id=loc["id"],
        industry_id=ind["id"],
        provider_slug=prov,
        country_code=loc.get("country_code", ""),
        state_name=loc.get("state_name", ""),
        city_name=loc.get("city_name", ""),
        industry_name=ind.get("name", ""),
        status=status,
        error_message=error_message,
    )
    db.add(cj)
    db.flush()
    return cj


def _create_search_job(db, campaign_job, loc, ind, prov, campaign) -> SearchJob:
    query = f"{ind['name']} in {loc.get('city_name', '')} {loc.get('country_code', '')}".strip()

    sj = SearchJob(
        query=query,
        country=loc.get("country_code", ""),
        city=loc.get("city_name", ""),
        area=loc.get("state_name", ""),
        industry=ind["name"],
        max_results=campaign.max_businesses_per_city,
        status=JobStatus.QUEUED.value,
        extra_data={
            "provider": prov,
            "campaign_job_id": str(campaign_job.id),
            "campaign_id": str(campaign.id),
        },
    )
    db.add(sj)
    db.flush()
    return sj


def _dispatch_jobs(campaign_id: str, concurrency: int):
    """Dispatch the next batch of queued jobs to Celery workers."""
    import requests as http_requests

    with get_db_context() as db:
        queued = db.query(CampaignJob).filter(
            CampaignJob.campaign_id == campaign_id,
            CampaignJob.status == "queued",
            CampaignJob.search_job_id.isnot(None),
            CampaignJob.is_deleted == False,
        ).limit(concurrency * 2).all()

        enqueuer_url = "http://task-enqueuer:8002"
        dispatched = 0

        for cj in queued:
            try:
                resp = http_requests.post(
                    f"{enqueuer_url}/enqueue",
                    json={
                        "task": "worker.tasks.search.discover_businesses",
                        "args": [str(cj.search_job_id)],
                        "kwargs": {},
                        "queue": "search",
                    },
                    timeout=5,
                )
                if resp.status_code == 200:
                    cj.status = "running"
                    dispatched += 1
                else:
                    logger.warning(f"Enqueue failed for {cj.id}: {resp.status_code}")
            except Exception as e:
                logger.error(f"Enqueue error for {cj.id}: {e}")

        db.commit()
        logger.info(f"Dispatched {dispatched}/{len(queued)} jobs for campaign {campaign_id}")


@app.task(name="worker.tasks.campaign_orchestrator.update_campaign_progress")
def update_campaign_progress():
    """Periodic task: recalculate progress counters for all active campaigns."""
    with get_db_context() as db:
        active = db.query(DiscoveryCampaign).filter(
            DiscoveryCampaign.status == "active",
            DiscoveryCampaign.is_deleted == False,
        ).all()

        for campaign in active:
            _recalculate_progress(db, campaign)

        db.commit()


def _recalculate_progress(db, campaign):
    jobs = db.query(CampaignJob).filter(
        CampaignJob.campaign_id == campaign.id,
        CampaignJob.is_deleted == False,
    ).all()

    campaign.total_jobs = len(jobs)
    campaign.queued_jobs = sum(1 for j in jobs if j.status == "queued")
    campaign.running_jobs = sum(1 for j in jobs if j.status == "running")
    campaign.completed_jobs = sum(1 for j in jobs if j.status == "completed")
    campaign.failed_jobs = sum(1 for j in jobs if j.status == "failed")
    campaign.skipped_jobs = sum(1 for j in jobs if j.status == "skipped")

    campaign.total_businesses = sum(j.businesses_found or 0 for j in jobs)
    campaign.unique_businesses = sum(j.new_businesses or 0 for j in jobs)
    campaign.duplicate_count = sum(j.duplicates_found or 0 for j in jobs)

    if (
        campaign.queued_jobs == 0
        and campaign.running_jobs == 0
        and campaign.completed_jobs > 0
    ):
        campaign.status = "completed"


@app.task(name="worker.tasks.campaign_orchestrator.retry_failed_jobs")
def retry_failed_jobs(campaign_id: str):
    """Retry failed jobs using provider fallback."""
    from worker.services.provider_orchestrator import provider_orchestrator

    with get_db_context() as db:
        failed = db.query(CampaignJob).filter(
            CampaignJob.campaign_id == campaign_id,
            CampaignJob.status == "failed",
            CampaignJob.retry_count < 3,
            CampaignJob.is_deleted == False,
        ).all()

        retried = 0
        for cj in failed:
            ranked = provider_orchestrator.get_ranked_providers(
                cj.country_code or "",
                [cj.provider_slug] if cj.provider_slug else [],
            )

            current_idx = ranked.index(cj.provider_slug) if cj.provider_slug in ranked else -1
            fallbacks = ranked[current_idx + 1:] if current_idx >= 0 else ranked

            if fallbacks:
                next_provider = fallbacks[0]
                cj.fallback_provider = next_provider
                cj.provider_slug = next_provider
                cj.status = "queued"
                cj.retry_count += 1
                cj.error_message = None

                if cj.search_job_id:
                    sj = db.query(SearchJob).filter(SearchJob.id == cj.search_job_id).first()
                    if sj:
                        sj.extra_data = {**(sj.extra_data or {}), "provider": next_provider}
                retried += 1
            else:
                cj.status = "failed"
                cj.error_message = "All providers exhausted"

        db.commit()
        logger.info(f"Retried {retried}/{len(failed)} failed jobs in campaign {campaign_id}")

        if retried > 0:
            _dispatch_jobs(campaign_id, 10)

        return {"retried": retried, "exhausted": len(failed) - retried}


@app.task(name="worker.tasks.campaign_orchestrator.record_search_result")
def record_search_result(search_job_id: str):
    """
    Called after a discover_businesses task completes.
    Updates the linked CampaignJob with results and provider metrics.
    """
    import time
    from worker.services.provider_orchestrator import provider_orchestrator

    with get_db_context() as db:
        sj = db.query(SearchJob).filter(SearchJob.id == search_job_id).first()
        if not sj:
            return

        cj_id = (sj.extra_data or {}).get("campaign_job_id")
        if not cj_id:
            return

        cj = db.query(CampaignJob).filter(CampaignJob.id == cj_id).first()
        if not cj:
            return

        from worker.models import SearchResult
        results = db.query(SearchResult).filter(
            SearchResult.search_job_id == search_job_id
        ).all()

        total = len(results)
        duplicates = sum(1 for r in results if r.is_duplicate)
        new = total - duplicates

        cj.businesses_found = total
        cj.duplicates_found = duplicates
        cj.new_businesses = new
        cj.status = "completed" if sj.status == JobStatus.COMPLETED.value else "failed"
        if sj.error_message:
            cj.error_message = sj.error_message
        if sj.started_at and sj.completed_at:
            cj.runtime_ms = int(
                (sj.completed_at - sj.started_at).total_seconds() * 1000
            )
        cj.updated_at = datetime.utcnow()

        provider_slug = cj.provider_slug or "google_maps"
        country_code = cj.country_code or ""

        if sj.status == JobStatus.COMPLETED.value:
            provider_orchestrator.record_success(
                provider_slug, country_code,
                latency_ms=cj.runtime_ms or 0,
                results_count=total,
                duplicates=duplicates,
            )
        else:
            provider_orchestrator.record_failure(
                provider_slug, country_code,
                error=sj.error_message or "Unknown error",
            )

        db.commit()

        _update_parent_campaign(db, cj.campaign_id)


def _update_parent_campaign(db, campaign_id):
    """Recalculate and persist campaign-level aggregates."""
    campaign = db.query(DiscoveryCampaign).filter(
        DiscoveryCampaign.id == campaign_id,
        DiscoveryCampaign.is_deleted == False,
    ).first()
    if campaign:
        _recalculate_progress(db, campaign)
        db.commit()
