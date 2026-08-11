"""Search task — discovers businesses from providers with deduplication, geocoding, and chained processing."""
import asyncio
import logging
import time
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import SearchJob, SearchResult, Company, Lead, JobStatus
from worker.providers.registry import registry

logger = logging.getLogger(__name__)

SEARCH_HARD_TIMEOUT = 240


def _update_progress(db, job, progress: int, message: str):
    job.progress = progress
    meta = job.extra_data or {}
    meta["progress_message"] = message
    job.extra_data = meta
    db.commit()


@app.task(bind=True, name="worker.tasks.search.discover_businesses")
def discover_businesses(self, job_id: str):
    logger.info(f"Starting search job: {job_id}")
    t0 = time.time()

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

            _update_progress(db, job, 5, "Parsing search query...")
            extra = job.extra_data or {}
            provider_slug = extra.get("provider", "google_maps")
            lat = extra.get("lat")
            lng = extra.get("lng")
            radius_km = extra.get("radius_km")

            if not query and not location:
                query = job.query or ""
            if not location and query:
                from worker.services.smart_query import smart_query_parser
                parsed = smart_query_parser.parse(query)
                if parsed.industry and not job.industry:
                    query = parsed.industry
                if parsed.location:
                    location = parsed.location
                if provider_slug == "google_maps" and lat is None:
                    hint = smart_query_parser.provider_hint(parsed)
                    if hint and hint != "google_maps":
                        provider_slug = hint
                job.extra_data = {**(job.extra_data or {}), "smart_parse": parsed.to_dict()}

            _update_progress(db, job, 10, f"Searching for '{query}' in {location or 'any location'}...")

            # Run search with timeout guard
            results = _run_search_with_timeout(
                provider_slug=provider_slug,
                query=query,
                location=location,
                max_results=job.max_results or 50,
                min_rating=job.min_rating or 0,
                min_reviews=job.min_reviews or 0,
                lat=float(lat) if lat is not None else None,
                lng=float(lng) if lng is not None else None,
                radius_km=float(radius_km or 10),
                timeout=SEARCH_HARD_TIMEOUT - (time.time() - t0),
            )

            _update_progress(db, job, 30, f"Found {len(results)} businesses. Storing and deduplicating...")

            stored_count = 0
            duplicate_count = 0

            for result in results:
                try:
                    _store_result(db, job, result, provider_slug, stored_count, duplicate_count)
                    stored_count += 1
                except Exception as e:
                    logger.debug(f"Failed to store {result.name}: {e}")
                    duplicate_count += 1

            _update_progress(db, job, 70, f"Stored {stored_count} new companies. Geocoding...")

            # Geocode companies with zero coordinates
            new_company_ids = [
                sr.company_id for sr in db.query(SearchResult).filter(
                    SearchResult.search_job_id == job.id,
                    SearchResult.is_duplicate == False
                ).all()
            ]

            new_companies = db.query(Company).filter(Company.id.in_(new_company_ids)).all()
            geocoded = 0
            for company in new_companies:
                if (not company.latitude or company.latitude == 0) and (company.address or company.city):
                    try:
                        from worker.services.geocode import geocode_sync
                        addr = company.address or f"{company.name}, {company.city}, {company.country}"
                        geo = geocode_sync(addr)
                        if geo and geo.get("latitude"):
                            company.latitude = geo["latitude"]
                            company.longitude = geo["longitude"]
                            if not company.city and geo.get("city"):
                                company.city = geo["city"]
                            if not company.country and geo.get("country"):
                                company.country = geo["country"]
                            geocoded += 1
                    except Exception as e:
                        logger.debug(f"Geocoding failed for {company.name}: {e}")

            if geocoded:
                db.flush()
                logger.info(f"Geocoded {geocoded}/{len(new_companies)} companies")

            job.results_count = stored_count
            job.status = JobStatus.COMPLETED.value
            job.progress = 100
            job.completed_at = datetime.utcnow()
            meta = job.extra_data or {}
            meta["progress_message"] = f"Completed! {stored_count} new companies found."
            meta["stats"] = {
                "total_results": len(results),
                "new_companies": stored_count,
                "duplicates": duplicate_count,
                "geocoded": geocoded,
                "elapsed_s": round(time.time() - t0, 1),
            }
            job.extra_data = meta
            db.commit()

            logger.info(f"Search job {job_id} completed: {stored_count} new companies (from {len(results)} total)")

            # Dispatch processing for new companies (chained: scrape → audit → score)
            new_results = db.query(SearchResult).filter(
                SearchResult.search_job_id == job.id,
                SearchResult.is_duplicate == False
            ).all()
            for sr in new_results:
                try:
                    from worker.tasks.process import process_company
                    process_company.delay(str(sr.company_id))
                except Exception as e:
                    logger.warning(f"Failed to dispatch process for {sr.company_id}: {e}")

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


def _run_search_with_timeout(
    provider_slug: str,
    query: str,
    location: str,
    max_results: int,
    min_rating: float,
    min_reviews: float,
    lat: float = None,
    lng: float = None,
    radius_km: float = 10,
    timeout: float = SEARCH_HARD_TIMEOUT,
) -> list:
    """Run provider search with an overall timeout guard."""
    async def _do_search():
        kwargs = {}
        if lat is not None and lng is not None:
            kwargs["lat"] = lat
            kwargs["lng"] = lng
            kwargs["radius_km"] = radius_km

        provider = registry.get(provider_slug)
        if not provider:
            logger.error(f"Provider not found: {provider_slug}")
            return []

        if not provider.is_ready:
            await provider.initialize()

        if not provider.is_enabled:
            logger.warning(f"Provider {provider_slug} is disabled")
            return []

        if lat is not None and lng is not None and provider.supports_map_search:
            return await provider.search_by_map(
                query=query, lat=lat, lng=lng, radius_km=radius_km,
                max_results=max_results, min_rating=min_rating, min_reviews=min_reviews,
            )
        else:
            return await provider.search(
                query=query, location=location, max_results=max_results,
                min_rating=min_rating, min_reviews=min_reviews, **kwargs,
            )

    try:
        return asyncio.run(asyncio.wait_for(_do_search(), timeout=timeout))
    except asyncio.TimeoutError:
        logger.warning(f"Search timed out after {timeout}s for {provider_slug}")
        return []
    except Exception as e:
        logger.error(f"Search failed for {provider_slug}: {e}")
        return []


def _store_result(db, job, result, provider_slug: str, stored: int, dupes: int):
    """Store a single search result, deduplicating by website, phone, URL, name."""
    dedup_key = result.dedup_key()
    existing = None

    # Dedup by website
    if result.website:
        clean_website = result.website.lower().rstrip('/').replace('https://', '').replace('http://', '').replace('www.', '')
        existing = db.query(Company).filter(
            Company.website.ilike(f"%{clean_website}%"),
            Company.is_deleted == False
        ).first()

    # Dedup by phone
    if not existing and result.phone:
        import re as _re
        phone_digits = _re.sub(r'[^\d]', '', result.phone)
        if len(phone_digits) >= 8:
            suffix = phone_digits[-8:]
            with db.no_autoflush:
                phone_rows = db.query(Company.id, Company.phone).filter(
                    Company.phone.isnot(None),
                    Company.phone != "",
                    Company.is_deleted == False,
                ).yield_per(500)
                for cid, c_phone in phone_rows:
                    c_digits = _re.sub(r'[^\d]', '', c_phone or "")
                    if c_digits and len(c_digits) >= 8 and c_digits[-8:] == suffix:
                        existing = db.query(Company).get(cid)
                        break

    # Dedup by Google Maps URL
    if not existing and result.google_maps_url:
        existing = db.query(Company).filter(
            Company.google_maps_url == result.google_maps_url,
            Company.is_deleted == False
        ).first()

    # Dedup by name
    if not existing:
        existing = db.query(Company).filter(
            Company.name == result.name,
            Company.is_deleted == False
        ).first()

    if existing:
        # Update existing company with new data if it's better
        updated = False
        if result.phone and not existing.phone:
            existing.phone = result.phone
            updated = True
        if result.website and not existing.website:
            existing.website = result.website
            updated = True
        if result.address and not existing.address:
            existing.address = result.address
            updated = True
        if result.review_count and not existing.review_count:
            existing.review_count = result.review_count
            updated = True
        if result.latitude and (not existing.latitude or existing.latitude == 0):
            existing.latitude = result.latitude
            existing.longitude = result.longitude
            updated = True
        if updated:
            logger.debug(f"Updated existing company {existing.name} with new data")

        sr = SearchResult(
            search_job_id=job.id,
            company_id=existing.id,
            source=result.source or provider_slug,
            is_duplicate=True,
            raw_data={"name": result.name, "dedup_key": dedup_key},
        )
        db.add(sr)
        return

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

    sr = SearchResult(
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
        },
    )
    db.add(sr)
