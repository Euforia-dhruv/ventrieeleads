"""Search task - discovers businesses from multiple providers with improved deduplication and parallel search."""
import asyncio
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import SearchJob, SearchResult, Company, JobStatus
from worker.providers.registry import registry

logger = logging.getLogger(__name__)


@app.task(bind=True, name="worker.tasks.search.discover_businesses")
def discover_businesses(self, job_id: str):
    """Main search task - discovers businesses from configured providers with parallel search."""
    logger.info(f"Starting search job: {job_id}")

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
            query = f"{job.industry or ''} {job.keyword or ''}".strip()
            if not query:
                query = job.query

            location = f"{job.area or ''} {job.city or ''} {job.country or ''}".strip()

            extra = job.extra_data or {}
            metadata = job.metadata or {}
            provider_slug = extra.get("provider") or metadata.get("provider", "google_maps")
            lat = extra.get("lat") or metadata.get("lat")
            lng = extra.get("lng") or metadata.get("lng")
            radius_km = extra.get("radius_km") or metadata.get("radius_km")

            if provider_slug == "all":
                if lat is not None and lng is not None:
                    results = asyncio.run(
                        registry.search_all(
                            query=query,
                            location=location,
                            max_results=job.max_results or 50,
                            min_rating=job.min_rating or 0,
                            min_reviews=job.min_reviews or 0,
                            parallel=True,
                            retries=2,
                            lat=float(lat),
                            lng=float(lng),
                            radius_km=float(radius_km or 10),
                        )
                    )
                else:
                    results = asyncio.run(
                        registry.search_all(
                            query=query,
                            location=location,
                            max_results=job.max_results or 50,
                            min_rating=job.min_rating or 0,
                            min_reviews=job.min_reviews or 0,
                            parallel=True,
                            retries=2,
                        )
                    )
            else:
                if lat is not None and lng is not None:
                    provider = registry.get(provider_slug)
                    if provider and provider.supports_map_search:
                        results = asyncio.run(
                            provider.search_by_map(
                                query=query,
                                lat=float(lat),
                                lng=float(lng),
                                radius_km=float(radius_km or 10),
                                max_results=job.max_results or 50,
                                min_rating=job.min_rating or 0,
                                min_reviews=job.min_reviews or 0,
                            )
                        )
                    else:
                        results = asyncio.run(
                            registry.search_single(
                                provider_slug=provider_slug,
                                query=query,
                                location=location,
                                max_results=job.max_results or 50,
                                min_rating=job.min_rating or 0,
                                min_reviews=job.min_reviews or 0,
                            )
                        )
                else:
                    results = asyncio.run(
                        registry.search_single(
                            provider_slug=provider_slug,
                            query=query,
                            location=location,
                            max_results=job.max_results or 50,
                            min_rating=job.min_rating or 0,
                            min_reviews=job.min_reviews or 0,
                        )
                    )

            job.progress = 30
            db.commit()

            stored_count = 0
            for result in results:
                dedup_key = result.dedup_key()
                existing = None

                if result.website:
                    from worker.models import Company as CompanyModel
                    clean_website = result.website.lower().rstrip('/').replace('https://', '').replace('http://', '').replace('www.', '')
                    existing = db.query(CompanyModel).filter(
                        CompanyModel.website.ilike(f"%{clean_website}%"),
                        CompanyModel.is_deleted == False
                    ).first()

                if not existing and result.phone:
                    import re
                    phone_digits = re.sub(r'[^\d]', '', result.phone)
                    if len(phone_digits) >= 8:
                        from worker.models import Company as CompanyModel
                        companies = db.query(CompanyModel).filter(
                            CompanyModel.is_deleted == False
                        ).all()
                        for c in companies:
                            c_digits = re.sub(r'[^\d]', '', c.phone or "")
                            if c_digits and len(c_digits) >= 8 and c_digits[-8:] == phone_digits[-8:]:
                                existing = c
                                break

                if not existing and result.google_maps_url:
                    from worker.models import Company as CompanyModel
                    existing = db.query(CompanyModel).filter(
                        CompanyModel.google_maps_url == result.google_maps_url,
                        CompanyModel.is_deleted == False
                    ).first()

                if not existing:
                    existing = db.query(CompanyModel).filter(
                        CompanyModel.name == result.name,
                        CompanyModel.is_deleted == False
                    ).first() if not existing else existing

                if not existing:
                    company = Company(
                        name=result.name,
                        website=result.website or "",
                        industry=result.industry or "",
                        city=job.city or result.city or "",
                        area=job.area or result.area or "",
                        country=job.country or result.country or "",
                        address=result.address or "",
                        phone=result.phone or "",
                        email=result.email or "",
                        rating=result.rating or 0,
                        review_count=result.review_count or 0,
                        opening_hours=result.opening_hours or {},
                        latitude=result.latitude or 0,
                        longitude=result.longitude or 0,
                        google_maps_url=result.google_maps_url or "",
                        logo_url=result.logo_url or "",
                        source=result.source or provider_slug,
                        provider_slug=result.source or provider_slug,
                        provider_raw_data=result.raw_data or {},
                        extra_data=result.metadata or {},
                    )
                    db.add(company)
                    db.flush()

                    search_result = SearchResult(
                        search_job_id=job.id,
                        company_id=company.id,
                        source=result.source or provider_slug,
                        raw_data={
                            "name": result.name,
                            "address": result.address,
                            "rating": result.rating,
                            "reviews": result.review_count,
                            "source": result.source,
                            "dedup_key": dedup_key,
                        }
                    )
                    db.add(search_result)
                    stored_count += 1
                else:
                    search_result = SearchResult(
                        search_job_id=job.id,
                        company_id=existing.id,
                        source=result.source or provider_slug,
                        is_duplicate=True,
                        raw_data={"name": result.name, "dedup_key": dedup_key}
                    )
                    db.add(search_result)

            job.progress = 100
            job.results_count = stored_count
            job.status = JobStatus.COMPLETED.value
            job.completed_at = datetime.utcnow()
            db.commit()

            logger.info(f"Search job {job_id} completed: {stored_count} new companies found (from {len(results)} total)")

            from worker.tasks.process import process_company
            new_results = db.query(SearchResult).filter(
                SearchResult.search_job_id == job.id,
                SearchResult.is_duplicate == False
            ).all()
            for sr in new_results:
                process_company.delay(str(sr.company_id))

            if extra.get("campaign_job_id"):
                try:
                    from worker.tasks.campaign_orchestrator import record_search_result
                    record_search_result.delay(job_id)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Search job {job_id} failed: {e}")
            job.status = JobStatus.FAILED.value
            job.error_message = str(e)[:1000]
            job.completed_at = datetime.utcnow()
            db.commit()

            if (job.extra_data or {}).get("campaign_job_id"):
                try:
                    from worker.tasks.campaign_orchestrator import record_search_result
                    record_search_result.delay(job_id)
                except Exception:
                    pass
            raise
