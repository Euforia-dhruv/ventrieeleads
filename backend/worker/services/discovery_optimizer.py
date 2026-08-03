"""Discovery Optimizer - avoids unnecessary work, deduplicates, refreshes."""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict
from worker.models.database import get_db_context
from worker.models import CampaignJob, Company, Location, Industry

logger = logging.getLogger(__name__)

SKIP_THRESHOLD_HOURS = 24
REFRESH_THRESHOLD_DAYS = 7


class DiscoveryOptimizer:
    """Determines whether to skip, refresh, or create new discovery jobs."""

    def should_skip(
        self, location_id: str, industry_id: str, provider_slug: str
    ) -> Tuple[bool, Optional[str], str]:
        """
        Check if we should skip this job.
        Returns (should_skip, existing_campaign_job_id, reason).
        """
        with get_db_context() as db:
            recent = db.query(CampaignJob).filter(
                CampaignJob.location_id == location_id,
                CampaignJob.industry_id == industry_id,
                CampaignJob.provider_slug == provider_slug,
                CampaignJob.status == "completed",
                CampaignJob.is_deleted == False,
                CampaignJob.created_at > datetime.utcnow() - timedelta(hours=SKIP_THRESHOLD_HOURS),
            ).first()

            if recent:
                return (
                    True,
                    str(recent.id),
                    f"Completed {recent.created_at.isoformat()} (within {SKIP_THRESHOLD_HOURS}h)",
                )
            return False, None, "No recent completed job"

    def should_refresh_company(self, company_id: str) -> bool:
        """Check if a company's data is stale and should be refreshed."""
        with get_db_context() as db:
            company = db.query(Company).filter(Company.id == company_id).first()
            if not company or not company.updated_at:
                return True
            age = datetime.utcnow() - company.updated_at.replace(tzinfo=None)
            return age > timedelta(days=REFRESH_THRESHOLD_DAYS)

    def get_existing_company_ids(
        self, country: str, city: str, industry: str
    ) -> List[str]:
        """Get company IDs that already exist for a given location × industry."""
        with get_db_context() as db:
            companies = db.query(Company.id).filter(
                Company.country == country,
                Company.city == city,
                Company.industry == industry,
                Company.is_deleted == False,
            ).all()
            return [str(c.id) for c in companies]

    def get_coverage_stats(self) -> Dict:
        """Get global coverage statistics across all locations and industries."""
        with get_db_context() as db:
            total_countries = db.query(Location).filter(
                Location.location_type == "country",
                Location.is_deleted == False,
                Location.is_active == True,
            ).count()

            total_states = db.query(Location).filter(
                Location.location_type == "state",
                Location.is_deleted == False,
                Location.is_active == True,
            ).count()

            total_cities = db.query(Location).filter(
                Location.location_type == "city",
                Location.is_deleted == False,
                Location.is_active == True,
            ).count()

            total_industries = db.query(Industry).filter(
                Industry.is_deleted == False,
                Industry.is_active == True,
            ).count()

            covered_location_ids = [
                row[0]
                for row in db.query(CampaignJob.location_id)
                .filter(
                    CampaignJob.status == "completed",
                    CampaignJob.is_deleted == False,
                )
                .distinct()
                .all()
            ]

            covered_industry_ids = [
                row[0]
                for row in db.query(CampaignJob.industry_id)
                .filter(
                    CampaignJob.status == "completed",
                    CampaignJob.is_deleted == False,
                )
                .distinct()
                .all()
            ]

            countries_with_coverage = 0
            if covered_location_ids:
                countries_with_coverage = db.query(Location).filter(
                    Location.location_type == "country",
                    Location.is_deleted == False,
                    Location.id.in_(covered_location_ids),
                ).count()

            total_companies = db.query(Company).filter(
                Company.is_deleted == False
            ).count()

            total_campaigns = db.query(DiscoveryCampaign).filter(
                DiscoveryCampaign.is_deleted == False
            ).count() if hasattr(DiscoveryCampaign, '__tablename__') else 0

            return {
                "total_countries": total_countries,
                "total_states": total_states,
                "total_cities": total_cities,
                "total_industries": total_industries,
                "covered_locations": len(covered_location_ids),
                "covered_industries": len(covered_industry_ids),
                "countries_with_coverage": countries_with_coverage,
                "total_companies": total_companies,
                "location_coverage_pct": round(
                    len(covered_location_ids) / max(total_cities, 1) * 100, 1
                ),
                "industry_coverage_pct": round(
                    len(covered_industry_ids) / max(total_industries, 1) * 100, 1
                ),
                "country_coverage_pct": round(
                    countries_with_coverage / max(total_countries, 1) * 100, 1
                ),
            }

    def get_country_coverage(self) -> List[Dict]:
        """Get coverage breakdown per country."""
        with get_db_context() as db:
            countries = db.query(Location).filter(
                Location.location_type == "country",
                Location.is_deleted == False,
                Location.is_active == True,
            ).order_by(Location.name).all()

            result = []
            for country in countries:
                city_count = db.query(Location).filter(
                    Location.country_code == country.country_code,
                    Location.location_type == "city",
                    Location.is_deleted == False,
                ).count()

                state_count = db.query(Location).filter(
                    Location.country_code == country.country_code,
                    Location.location_type == "state",
                    Location.is_deleted == False,
                ).count()

                completed_jobs = db.query(CampaignJob).filter(
                    CampaignJob.country_code == country.country_code,
                    CampaignJob.status == "completed",
                    CampaignJob.is_deleted == False,
                ).count()

                total_jobs = db.query(CampaignJob).filter(
                    CampaignJob.country_code == country.country_code,
                    CampaignJob.is_deleted == False,
                ).count()

                companies = db.query(Company).filter(
                    Company.country == country.country_code,
                    Company.is_deleted == False,
                ).count()

                businesses_in_jobs = 0
                if total_jobs > 0:
                    from sqlalchemy import func
                    row = db.query(func.sum(CampaignJob.businesses_found)).filter(
                        CampaignJob.country_code == country.country_code,
                        CampaignJob.is_deleted == False,
                    ).scalar()
                    businesses_in_jobs = row or 0

                result.append({
                    "country_code": country.country_code,
                    "country_name": country.name,
                    "total_states": state_count,
                    "total_cities": city_count,
                    "completed_jobs": completed_jobs,
                    "total_jobs": total_jobs,
                    "total_companies": companies,
                    "businesses_discovered": businesses_in_jobs,
                    "coverage_pct": round(
                        completed_jobs / max(city_count * 5, 1) * 100, 1
                    ),
                })

            return sorted(result, key=lambda x: x["total_companies"], reverse=True)

    def get_industry_coverage(self) -> List[Dict]:
        """Get coverage breakdown per industry."""
        with get_db_context() as db:
            industries = db.query(Industry).filter(
                Industry.is_deleted == False,
                Industry.is_active == True,
                Industry.parent_id.isnot(None),
            ).order_by(Industry.name).all()

            result = []
            for ind in industries:
                completed_jobs = db.query(CampaignJob).filter(
                    CampaignJob.industry_id == ind.id,
                    CampaignJob.status == "completed",
                    CampaignJob.is_deleted == False,
                ).count()

                companies = db.query(Company).filter(
                    Company.industry == ind.name,
                    Company.is_deleted == False,
                ).count()

                result.append({
                    "industry_id": str(ind.id),
                    "industry_name": ind.name,
                    "parent_id": str(ind.parent_id) if ind.parent_id else None,
                    "completed_jobs": completed_jobs,
                    "total_companies": companies,
                })

            return sorted(result, key=lambda x: x["total_companies"], reverse=True)


discovery_optimizer = DiscoveryOptimizer()
