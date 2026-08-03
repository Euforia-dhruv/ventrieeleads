"""Periodic intelligence analytics tasks."""
import logging
from celery import shared_task
from datetime import datetime

logger = logging.getLogger(__name__)


@shared_task(name='worker.tasks.intelligence_analytics.generate_executive_report', bind=True,
             soft_time_limit=300, time_limit=600)
def generate_executive_report(self):
    """Generate and persist an executive AI report."""
    from worker.services.intelligence import intelligence_service
    from worker.models.database import SessionLocal
    from worker.models import ExecutiveAiReport

    session = SessionLocal()
    try:
        report = intelligence_service.generate_executive_report()
        now = datetime.utcnow()

        db_report = ExecutiveAiReport(
            report_date=now,
            report_type="daily_executive",
            title=report.get("title", f"Executive Report - {now.strftime('%Y-%m-%d')}"),
            summary=report.get("summary", ""),
            content={
                "discovery": report.get("discovery", {}),
                "providers": report.get("providers", {}),
                "market": report.get("market", {}),
                "pipeline": report.get("pipeline", {}),
                "economics": report.get("economics", {}),
                "predictive": report.get("predictive", {}),
            },
            recommendations=report.get("recommendations", []),
            top_opportunities=report.get("opportunities", {}).get("top_100", []),
            top_cities=report.get("top_cities", []),
            top_industries=report.get("top_industries", []),
            top_providers=[p.get("provider", "") for p in report.get("providers", {}).get("providers", [])[:10]],
            system_health=report.get("pipeline", {}).get("metrics", {}),
            economics=report.get("economics", {}),
        )
        session.add(db_report)
        session.commit()

        logger.info(f"Executive report generated: {db_report.id}")
        return {"success": True, "report_id": str(db_report.id)}

    except Exception as e:
        session.rollback()
        logger.error(f"Failed to generate executive report: {e}")
        return {"success": False, "error": str(e)}
    finally:
        session.close()


@shared_task(name='worker.tasks.intelligence_analytics.compute_opportunity_scores', bind=True,
             soft_time_limit=300, time_limit=600)
def compute_opportunity_scores(self):
    """Compute and persist company intelligence scores."""
    from worker.services.intelligence import intelligence_service
    from worker.models.database import SessionLocal
    from worker.models import CompanyIntelligenceScores, Company

    session = SessionLocal()
    try:
        companies = session.query(Company).filter(Company.is_deleted == False).all()

        count = 0
        for company in companies[:500]:
            existing = session.query(CompanyIntelligenceScores).filter(
                CompanyIntelligenceScores.company_id == company.id,
                CompanyIntelligenceScores.is_deleted == False
            ).first()

            website = None
            audit = None
            tech_count = 0

            if company.website:
                from worker.models import Website as W, Audit as A, Technology as T
                website = session.query(W).filter(W.company_id == company.id).first()
                if website:
                    audit = session.query(A).filter(A.website_id == website.id).first()
                    tech_count = session.query(T).filter(T.company_id == company.id).count()

            digital = intelligence_service._compute_digital_maturity(company, website, audit, tech_count)
            marketing = intelligence_service._compute_marketing_maturity(company, website)
            technology = intelligence_service._compute_technology_maturity(website, tech_count)
            branding = intelligence_service._compute_branding_maturity(company, website)
            sales = intelligence_service._compute_sales_readiness(company, website)
            growth = intelligence_service._compute_growth_score(company)
            ai = intelligence_service._compute_ai_readiness(website, tech_count)
            automation = intelligence_service._compute_automation_readiness(website, tech_count)
            expansion = intelligence_service._compute_expansion_potential(company)
            acquisition = intelligence_service._compute_acquisition_probability(company, website, audit)

            if existing:
                existing.growth_score = growth
                existing.digital_maturity_score = digital
                existing.marketing_maturity = marketing
                existing.technology_maturity = technology
                existing.branding_maturity = branding
                existing.sales_readiness = sales
                existing.ai_readiness = ai
                existing.automation_readiness = automation
                existing.expansion_potential = expansion
                existing.acquisition_probability = acquisition
                existing.computed_at = datetime.utcnow()
            else:
                entry = CompanyIntelligenceScores(
                    company_id=company.id,
                    growth_score=growth,
                    digital_maturity_score=digital,
                    marketing_maturity=marketing,
                    technology_maturity=technology,
                    branding_maturity=branding,
                    sales_readiness=sales,
                    ai_readiness=ai,
                    automation_readiness=automation,
                    expansion_potential=expansion,
                    acquisition_probability=acquisition,
                    computed_at=datetime.utcnow(),
                )
                session.add(entry)
            count += 1

        session.commit()
        logger.info(f"Computed scores for {count} companies")
        return {"success": True, "count": count}

    except Exception as e:
        session.rollback()
        logger.error(f"Failed to compute opportunity scores: {e}")
        return {"success": False, "error": str(e)}
    finally:
        session.close()


@shared_task(name='worker.tasks.intelligence_analytics.refresh_benchmarks', bind=True,
             soft_time_limit=300, time_limit=600)
def refresh_benchmarks(self):
    """Refresh benchmark snapshots for countries and industries."""
    from worker.models.database import SessionLocal
    from worker.models import BenchmarkSnapshot, Location, Industry, Company
    from worker.models import Audit as A, Website as W
    from datetime import timedelta

    session = SessionLocal()
    try:
        now = datetime.utcnow()
        week_start = now - timedelta(days=7)

        countries = session.query(Location).filter(
            Location.location_type == "country",
            Location.is_deleted == False, Location.is_active == True
        ).all()

        count = 0
        for country in countries:
            companies = session.query(Company).filter(
                Company.country == country.country_code,
                Company.is_deleted == False
            ).all()
            if not companies:
                continue

            company_ids = [str(c.id) for c in companies[:50]]
            audits = session.query(A).join(W).filter(
                W.company_id.in_(company_ids) if company_ids else False,
                A.is_deleted == False
            ).all() if company_ids else []

            website_scores = [a.overall_score for a in audits if a.overall_score]
            seo_scores = [a.seo_score for a in audits if a.seo_score]
            design_scores = [a.design_score for a in audits if a.design_score]
            perf_scores = [a.performance_score for a in audits if a.performance_score]
            ratings = [c.rating for c in companies if c.rating]
            reviews = [c.review_count for c in companies if c.review_count]

            session.add(BenchmarkSnapshot(
                snapshot_type="country",
                entity_id=country.id,
                entity_name=country.name,
                country_code=country.country_code,
                avg_website_score=round(sum(website_scores) / max(len(website_scores), 1), 1),
                avg_seo_score=round(sum(seo_scores) / max(len(seo_scores), 1), 1),
                avg_design_score=round(sum(design_scores) / max(len(design_scores), 1), 1),
                avg_performance_score=round(sum(perf_scores) / max(len(perf_scores), 1), 1),
                avg_rating=round(sum(ratings) / max(len(ratings), 1), 2),
                avg_review_count=round(sum(reviews) / max(len(reviews), 1)),
                total_companies=len(companies),
                period_start=week_start,
                period_end=now,
            ))
            count += 1

        industries = session.query(Industry).filter(
            Industry.is_deleted == False, Industry.is_active == True,
            Industry.parent_id.isnot(None)
        ).all()

        for ind in industries:
            companies = session.query(Company).filter(
                Company.industry == ind.name, Company.is_deleted == False
            ).all()
            if not companies:
                continue

            company_ids = [str(c.id) for c in companies[:50]]
            audits = session.query(A).join(W).filter(
                W.company_id.in_(company_ids) if company_ids else False,
                A.is_deleted == False
            ).all() if company_ids else []

            website_scores = [a.overall_score for a in audits if a.overall_score]
            ratings = [c.rating for c in companies if c.rating]

            session.add(BenchmarkSnapshot(
                snapshot_type="industry",
                entity_id=ind.id,
                entity_name=ind.name,
                avg_website_score=round(sum(website_scores) / max(len(website_scores), 1), 1),
                avg_rating=round(sum(ratings) / max(len(ratings), 1), 2),
                total_companies=len(companies),
                period_start=week_start,
                period_end=now,
            ))
            count += 1

        session.commit()
        logger.info(f"Refreshed {count} benchmark snapshots")
        return {"success": True, "count": count}

    except Exception as e:
        session.rollback()
        logger.error(f"Failed to refresh benchmarks: {e}")
        return {"success": False, "error": str(e)}
    finally:
        session.close()
