"""Intelligence Layer - 10 modules of self-improving analytics.

Module 1: Discovery Intelligence
Module 2: Provider AI
Module 3: Market Intelligence
Module 4: Opportunity Intelligence
Module 5: Global Heatmap
Module 6: Predictive Discovery
Module 7: Self-Optimising Pipeline
Module 8: Discovery Economics
Module 9: Global Benchmarks
Module 10: Executive AI
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from worker.models.database import get_db_context
from worker.models import (
    Company, Lead, Location, Industry, Audit, Website, Technology,
    SearchJob, SearchResult, CampaignJob, DiscoveryCampaign,
    Opportunity, ProviderMetrics, AgentEvent,
)

logger = logging.getLogger(__name__)


class IntelligenceService:
    """Central intelligence service computing all platform analytics."""

    # ─── MODULE 1: Discovery Intelligence ───────────────────────────

    def get_discovery_intelligence(self) -> Dict:
        with get_db_context() as db:
            total_companies = db.query(Company).filter(Company.is_deleted == False).count()
            total_locations = db.query(Location).filter(
                Location.is_deleted == False, Location.is_active == True,
                Location.location_type == "city"
            ).count()
            total_industries = db.query(Industry).filter(
                Industry.is_deleted == False, Industry.is_active == True,
                Industry.parent_id.isnot(None)
            ).count()

            covered_locations = db.query(CampaignJob.location_id).filter(
                CampaignJob.status == "completed", CampaignJob.is_deleted == False
            ).distinct().count()

            covered_industries = db.query(CampaignJob.industry_id).filter(
                CampaignJob.status == "completed", CampaignJob.is_deleted == False
            ).distinct().count()

            countries_with_data = db.query(Company.country).filter(
                Company.is_deleted == False, Company.country != ""
            ).distinct().count()

            coverage_score = round(covered_locations / max(total_locations, 1) * 100, 1)
            industry_coverage = round(covered_industries / max(total_industries, 1) * 100, 1)

            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)

            new_this_week = db.query(Company).filter(
                Company.is_deleted == False, Company.created_at > week_ago
            ).count()

            new_this_month = db.query(Company).filter(
                Company.is_deleted == False, Company.created_at > month_ago
            ).count()

            velocity = round(new_this_week / 7, 1) if new_this_week else 0

            avg_density = round(total_companies / max(total_locations, 1), 1)

            growth_rate = 0
            two_weeks_ago = now - timedelta(days=14)
            prev_week = db.query(Company).filter(
                Company.is_deleted == False,
                Company.created_at > two_weeks_ago,
                Company.created_at <= week_ago
            ).count()
            if prev_week > 0:
                growth_rate = round((new_this_week - prev_week) / max(prev_week, 1) * 100, 1)

            confidence = min(100, round(
                (coverage_score * 0.3) + (min(velocity, 50) * 2 * 0.3) +
                (min(total_companies, 1000) / 10 * 0.2) + (industry_coverage * 0.2), 1
            ))

            recommendations = self._generate_discovery_recommendations(
                db, coverage_score, velocity, growth_rate, total_companies
            )

            return {
                "summary": {
                    "total_companies": total_companies,
                    "total_locations": total_locations,
                    "total_industries": total_industries,
                    "covered_locations": covered_locations,
                    "covered_industries": covered_industries,
                    "countries_with_data": countries_with_data,
                },
                "scores": {
                    "coverage_score": coverage_score,
                    "industry_coverage": industry_coverage,
                    "discovery_velocity": velocity,
                    "business_density": avg_density,
                    "growth_rate": growth_rate,
                    "discovery_confidence": confidence,
                },
                "trends": {
                    "new_this_week": new_this_week,
                    "new_this_month": new_this_month,
                    "velocity_per_day": velocity,
                },
                "recommendations": recommendations,
            }

    def _generate_discovery_recommendations(self, db, coverage, velocity, growth, total):
        recs = []
        if coverage < 20:
            recs.append({
                "title": "Expand geographic coverage",
                "description": f"Only {coverage}% of cities have been explored. Run discovery campaigns in uncovered regions.",
                "reasoning": "Low geographic coverage limits lead pool size and diversity.",
                "confidence": 0.9, "priority": 9, "type": "expansion",
            })
        if velocity < 5:
            recs.append({
                "title": "Increase discovery velocity",
                "description": f"Currently discovering {velocity:.0f} businesses/day. Increase concurrency or add providers.",
                "reasoning": "Higher velocity leads to faster pipeline growth.",
                "confidence": 0.85, "priority": 8, "type": "optimization",
            })
        if growth < 0:
            recs.append({
                "title": "Reverse growth decline",
                "description": f"Growth rate is {growth}%. Review provider health and campaign configurations.",
                "reasoning": "Negative growth indicates pipeline stagnation.",
                "confidence": 0.95, "priority": 10, "type": "alert",
            })
        if total < 100:
            recs.append({
                "title": "Run initial discovery campaigns",
                "description": f"Only {total} companies discovered. Create broad campaigns across major cities.",
                "reasoning": "A larger company pool improves opportunity identification.",
                "confidence": 0.95, "priority": 10, "type": "expansion",
            })
        uncov = db.query(Industry).filter(
            Industry.is_deleted == False, Industry.is_active == True,
            Industry.parent_id.isnot(None),
            ~Industry.id.in_(db.query(CampaignJob.industry_id).filter(
                CampaignJob.status == "completed", CampaignJob.is_deleted == False
            ))
        ).limit(5).all()
        if uncov:
            names = [i.name for i in uncov[:3]]
            recs.append({
                "title": f"Discover under-explored industries: {', '.join(names)}",
                "description": f"{len(uncov)} industries have zero coverage. These represent untapped markets.",
                "reasoning": "Untapped industries may have less competition and higher opportunity.",
                "confidence": 0.8, "priority": 7, "type": "opportunity",
            })
        return recs

    # ─── MODULE 2: Provider AI ──────────────────────────────────────

    def get_provider_intelligence(self) -> Dict:
        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.is_deleted == False
            ).all()

            providers = {}
            for m in metrics:
                if m.provider_slug not in providers:
                    providers[m.provider_slug] = {
                        "slug": m.provider_slug,
                        "countries": 0, "total_requests": 0, "successful": 0,
                        "failed": 0, "total_latency": 0, "total_results": 0.0,
                        "total_dup_rate": 0.0, "last_error": None, "by_country": {},
                    }
                p = providers[m.provider_slug]
                p["countries"] += 1
                p["total_requests"] += m.total_requests
                p["successful"] += m.successful_requests
                p["failed"] += m.failed_requests
                p["total_latency"] += m.avg_latency_ms * max(m.total_requests, 1)
                p["total_results"] += m.avg_results_per_request
                p["total_dup_rate"] += m.duplicate_rate
                if m.last_error:
                    p["last_error"] = m.last_error
                if m.total_requests > 0:
                    p["by_country"][m.country_code] = {
                        "success_rate": round(m.successful_requests / m.total_requests, 3),
                        "avg_latency": m.avg_latency_ms,
                        "avg_results": round(m.avg_results_per_request, 1),
                        "requests": m.total_requests,
                    }

            scored = []
            for slug, p in providers.items():
                total = max(p["total_requests"], 1)
                health = round(p["successful"] / total, 3)
                latency = max(0, 1 - p["total_latency"] / max(total * 30000, 1))
                quality = round(p["total_results"] / max(p["countries"], 1), 1)
                dup = round(1 - p["total_dup_rate"] / max(p["countries"], 1), 3)
                freshness = 1.0 if p.get("last_error") is None else 0.5
                composite = round(
                    health * 0.25 + latency * 0.15 + min(quality / 20, 1) * 0.2 +
                    dup * 0.15 + freshness * 0.1 + min(p["countries"] / 5, 1) * 0.15, 3
                )
                scored.append({
                    "provider": slug,
                    "scores": {
                        "health_score": health,
                        "coverage_score": min(p["countries"] / 5, 1),
                        "quality_score": min(quality / 20, 1),
                        "latency_score": latency,
                        "duplicate_score": dup,
                        "freshness_score": freshness,
                        "composite_score": composite,
                    },
                    "stats": {
                        "total_requests": p["total_requests"],
                        "success_rate": health,
                        "countries_served": p["countries"],
                        "avg_results_per_request": round(p["total_results"] / max(p["countries"], 1), 1),
                    },
                    "by_country": p["by_country"],
                    "last_error": p["last_error"],
                })

            scored.sort(key=lambda x: x["scores"]["composite_score"], reverse=True)

            recommendations = self._generate_provider_recommendations(scored)

            return {
                "providers": scored,
                "recommendations": recommendations,
            }

    def _generate_provider_recommendations(self, scored):
        recs = []
        if not scored:
            recs.append({
                "title": "No provider data available",
                "description": "Run discovery campaigns to collect provider performance metrics.",
                "confidence": 1.0, "priority": 10, "type": "setup",
            })
            return recs
        primary = scored[0]
        recs.append({
            "title": f"Primary provider: {primary['provider']}",
            "description": f"Composite score {primary['scores']['composite_score']:.2f}. Best overall performance.",
            "confidence": 0.9, "priority": 8, "type": "recommendation",
        })
        low_health = [s for s in scored if s["scores"]["health_score"] < 0.7]
        for s in low_health:
            recs.append({
                "title": f"Provider {s['provider']} needs attention",
                "description": f"Health score {s['scores']['health_score']:.0%}. Consider reducing load or switching.",
                "confidence": 0.85, "priority": 7, "type": "warning",
            })
        return recs

    # ─── MODULE 3: Market Intelligence ──────────────────────────────

    def get_market_intelligence(self) -> Dict:
        with get_db_context() as db:
            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)

            cities = db.query(Location).filter(
                Location.location_type == "city",
                Location.is_deleted == False, Location.is_active == True
            ).all()

            city_data = []
            for city in cities:
                companies = db.query(Company).filter(
                    Company.city == city.name, Company.is_deleted == False
                ).count()
                new_week = db.query(Company).filter(
                    Company.city == city.name, Company.is_deleted == False,
                    Company.created_at > week_ago
                ).count()
                if companies > 0 or new_week > 0:
                    city_data.append({
                        "city": city.name,
                        "country_code": city.country_code,
                        "total_companies": companies,
                        "new_this_week": new_week,
                        "growth_rate": round(new_week / max(companies, 1) * 100, 1),
                        "population": city.population or 0,
                        "gdp_usd": city.gdp_usd or 0,
                    })

            city_data.sort(key=lambda x: x["new_this_week"], reverse=True)

            industries = db.query(Industry).filter(
                Industry.is_deleted == False, Industry.is_active == True,
                Industry.parent_id.isnot(None)
            ).all()

            industry_data = []
            for ind in industries:
                companies = db.query(Company).filter(
                    Company.industry == ind.name, Company.is_deleted == False
                ).count()
                new_week = db.query(Company).filter(
                    Company.industry == ind.name, Company.is_deleted == False,
                    Company.created_at > week_ago
                ).count()
                if companies > 0:
                    industry_data.append({
                        "industry": ind.name,
                        "total_companies": companies,
                        "new_this_week": new_week,
                        "growth_rate": round(new_week / max(companies, 1) * 100, 1),
                    })

            industry_data.sort(key=lambda x: x["total_companies"], reverse=True)

            fastest_growing_cities = sorted(
                [c for c in city_data if c["total_companies"] >= 3],
                key=lambda x: x["growth_rate"], reverse=True
            )[:10]

            fastest_growing_industries = sorted(
                industry_data, key=lambda x: x["growth_rate"], reverse=True
            )[:10]

            most_competitive = sorted(industry_data, key=lambda x: x["total_companies"], reverse=True)[:10]
            least_competitive = sorted(
                [i for i in industry_data if i["total_companies"] > 0],
                key=lambda x: x["total_companies"]
            )[:10]

            return {
                "fastest_growing_cities": fastest_growing_cities,
                "fastest_growing_industries": fastest_growing_industries,
                "most_competitive_industries": most_competitive,
                "least_competitive_industries": least_competitive,
                "top_cities_by_volume": city_data[:10],
                "top_industries_by_volume": industry_data[:10],
                "emerging_markets": [
                    c for c in city_data
                    if c["growth_rate"] > 10 and c["total_companies"] < 20
                ][:10],
            }

    # ─── MODULE 4: Opportunity Intelligence ─────────────────────────

    def get_opportunity_intelligence(self) -> Dict:
        with get_db_context() as db:
            companies = db.query(Company).filter(Company.is_deleted == False).all()

            scored = []
            for c in companies:
                website = None
                audit = None
                tech_count = 0

                if c.website:
                    from worker.models import Website as W
                    website = db.query(W).filter(W.company_id == c.id).first()
                    if website:
                        from worker.models import Audit as A
                        audit = db.query(A).filter(A.website_id == website.id).first()
                        from worker.models import Technology as T
                        tech_count = db.query(T).filter(T.company_id == c.id).count()

                digital = self._compute_digital_maturity(c, website, audit, tech_count)
                marketing = self._compute_marketing_maturity(c, website)
                technology = self._compute_technology_maturity(website, tech_count)
                branding = self._compute_branding_maturity(c, website)
                sales = self._compute_sales_readiness(c, website)
                growth = self._compute_growth_score(c)
                ai = self._compute_ai_readiness(website, tech_count)
                automation = self._compute_automation_readiness(website, tech_count)
                expansion = self._compute_expansion_potential(c)
                acquisition = self._compute_acquisition_probability(c, website, audit)

                overall = round(
                    digital * 0.15 + marketing * 0.15 + technology * 0.15 +
                    branding * 0.1 + sales * 0.15 + growth * 0.1 +
                    ai * 0.05 + automation * 0.05 + expansion * 0.05 + acquisition * 0.05, 1
                )

                scored.append({
                    "company_id": str(c.id),
                    "company_name": c.name,
                    "industry": c.industry or "",
                    "city": c.city or "",
                    "country": c.country or "",
                    "scores": {
                        "overall": overall,
                        "growth_score": growth,
                        "digital_maturity": digital,
                        "marketing_maturity": marketing,
                        "technology_maturity": technology,
                        "branding_maturity": branding,
                        "sales_readiness": sales,
                        "ai_readiness": ai,
                        "automation_readiness": automation,
                        "expansion_potential": expansion,
                        "acquisition_probability": acquisition,
                    },
                })

            scored.sort(key=lambda x: x["scores"]["overall"], reverse=True)

            return {
                "total_scored": len(scored),
                "top_opportunities": scored[:100],
                "by_industry": self._group_scores_by(scored, "industry"),
                "summary": {
                    "avg_score": round(sum(s["scores"]["overall"] for s in scored) / max(len(scored), 1), 1),
                    "high_value": len([s for s in scored if s["scores"]["overall"] >= 70]),
                    "medium_value": len([s for s in scored if 40 <= s["scores"]["overall"] < 70]),
                    "low_value": len([s for s in scored if s["scores"]["overall"] < 40]),
                },
            }

    def _compute_digital_maturity(self, company, website, audit, tech_count):
        score = 0
        if company.website: score += 15
        if company.email: score += 10
        if company.phone: score += 5
        if website:
            if website.instagram: score += 10
            if website.facebook: score += 8
            if website.linkedin: score += 8
            if website.whatsapp: score += 5
        if audit:
            score += min(audit.overall_score * 0.4, 40)
        if tech_count > 3: score += 10
        elif tech_count > 0: score += 5
        return min(round(score, 1), 100)

    def _compute_marketing_maturity(self, company, website):
        score = 0
        if website:
            if website.instagram: score += 10
            if website.facebook: score += 15
            if website.linkedin: score += 15
            if website.youtube: score += 15
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                gmb = meta.get('gmb_reviews', 0)
                if gmb and gmb > 50: score += 20
                elif gmb and gmb > 10: score += 10
        if company.rating and company.rating >= 4.5:
            score += 10
        if company.review_count and company.review_count > 100:
            score += 10
        return min(round(score, 1), 100)

    def _compute_technology_maturity(self, website, tech_count):
        score = 0
        if tech_count > 10: score += 40
        elif tech_count > 5: score += 30
        elif tech_count > 2: score += 20
        elif tech_count > 0: score += 10
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                load_time = meta.get('load_time')
                if load_time and load_time < 3: score += 20
                elif load_time and load_time < 5: score += 10
                if meta.get('is_ssl'): score += 10
                if meta.get('is_mobile_friendly'): score += 15
        return min(round(score, 1), 100)

    def _compute_branding_maturity(self, company, website):
        score = 0
        if company.logo_url: score += 20
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                design_score = meta.get('design_score', 0)
                if design_score and design_score > 70: score += 30
                elif design_score and design_score > 40: score += 15
                if meta.get('brand_colors'): score += 15
                if meta.get('brand_fonts'): score += 10
        if company.description and len(company.description or "") > 100: score += 10
        return min(round(score, 1), 100)

    def _compute_sales_readiness(self, company, website):
        score = 0
        if company.email: score += 20
        if company.phone: score += 15
        if company.website: score += 10
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                if meta.get('has_contact_form'): score += 15
                if website.whatsapp or meta.get('has_whatsapp'): score += 10
                if meta.get('has_cta'): score += 15
                if meta.get('has_pricing_page'): score += 15
        return min(round(score, 1), 100)

    def _compute_growth_score(self, company):
        score = 50
        if company.review_count and company.review_count > 50: score += 15
        if company.rating and company.rating >= 4.0: score += 10
        age_days = (datetime.utcnow() - (company.created_at or datetime.utcnow())).days
        if age_days < 30: score += 10
        if company.extra_data and isinstance(company.extra_data, dict):
            if company.extra_data.get("trending"): score += 15
        return min(round(score, 1), 100)

    def _compute_ai_readiness(self, website, tech_count):
        score = 20
        if tech_count > 5: score += 20
        if tech_count > 10: score += 15
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                if meta.get('has_chatbot'): score += 25
                if meta.get('uses_cdn'): score += 10
                if meta.get('is_jamstack'): score += 10
        return min(round(score, 1), 100)

    def _compute_automation_readiness(self, website, tech_count):
        score = 15
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                if meta.get('has_booking_engine'): score += 25
                if meta.get('has_ecommerce'): score += 20
                if meta.get('has_crm'): score += 20
        if tech_count > 5: score += 10
        return min(round(score, 1), 100)

    def _compute_expansion_potential(self, company):
        score = 30
        if company.review_count and company.review_count > 100: score += 20
        if company.rating and company.rating >= 4.0: score += 10
        if company.website: score += 10
        if company.email: score += 5
        if company.phone: score += 5
        return min(round(score, 1), 100)

    def _compute_acquisition_probability(self, company, website, audit):
        score = 20
        if audit:
            if audit.overall_score and audit.overall_score < 50: score += 25
        if website:
            meta = getattr(website, 'extra_data', None) or {}
            if isinstance(meta, dict):
                if not meta.get('is_mobile_friendly'): score += 20
                load_time = meta.get('load_time')
                if load_time and load_time > 5: score += 15
        if audit and audit.overall_score and audit.overall_score < 40: score += 15
        if not company.website: score += 10
        return min(round(score, 1), 100)

    def _group_scores_by(self, scored, field):
        groups = {}
        for s in scored:
            key = s.get(field, "Unknown") or "Unknown"
            if key not in groups:
                groups[key] = {"count": 0, "avg_score": 0, "total_score": 0}
            groups[key]["count"] += 1
            groups[key]["total_score"] += s["scores"]["overall"]
        for k in groups:
            groups[k]["avg_score"] = round(groups[k]["total_score"] / max(groups[k]["count"], 1), 1)
            del groups[k]["total_score"]
        return dict(sorted(groups.items(), key=lambda x: x[1]["avg_score"], reverse=True))

    # ─── MODULE 5: Global Heatmap ───────────────────────────────────

    def get_heatmap_data(self) -> Dict:
        with get_db_context() as db:
            countries = db.query(Location).filter(
                Location.location_type == "country",
                Location.is_deleted == False, Location.is_active == True
            ).all()

            country_data = []
            for country in countries:
                cities = db.query(Location).filter(
                    Location.country_code == country.country_code,
                    Location.location_type == "city",
                    Location.is_deleted == False
                ).all()

                city_names = [c.name for c in cities]
                companies = db.query(Company).filter(
                    Company.country == country.country_code,
                    Company.is_deleted == False
                ).count()

                coverage = db.query(CampaignJob).filter(
                    CampaignJob.country_code == country.country_code,
                    CampaignJob.status == "completed",
                    CampaignJob.is_deleted == False
                ).count()

                jobs_with_businesses = db.query(CampaignJob).filter(
                    CampaignJob.country_code == country.country_code,
                    CampaignJob.is_deleted == False,
                    CampaignJob.businesses_found > 0
                ).all()

                avg_opp = 0
                avg_project = 0
                if jobs_with_businesses:
                    total_biz = sum(j.businesses_found or 0 for j in jobs_with_businesses)
                    avg_project = round(total_biz * 15000, 0)

                website_scores = []
                from worker.models import Audit as A
                for c_name in city_names[:5]:
                    audited = db.query(A).join(Company).filter(
                        Company.city == c_name,
                        Company.country == country.country_code,
                        A.is_deleted == False
                    ).limit(10).all()
                    website_scores.extend([a.overall_score for a in audited if a.overall_score])

                avg_website = round(sum(website_scores) / max(len(website_scores), 1), 1) if website_scores else 0

                density = round(companies / max(len(cities), 1), 1)

                country_data.append({
                    "country_code": country.country_code,
                    "country_name": country.name,
                    "latitude": country.latitude,
                    "longitude": country.longitude,
                    "total_cities": len(cities),
                    "total_companies": companies,
                    "coverage_jobs": coverage,
                    "lead_density": density,
                    "avg_website_score": avg_website,
                    "avg_opportunity_score": avg_opp,
                    "avg_project_value": avg_project,
                    "coverage_pct": round(coverage / max(len(cities) * 5, 1) * 100, 1),
                })

            country_data.sort(key=lambda x: x["total_companies"], reverse=True)

            return {"countries": country_data}

    # ─── MODULE 6: Predictive Discovery ─────────────────────────────

    def get_predictive_discovery(self) -> Dict:
        with get_db_context() as db:
            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)

            cities = db.query(Location).filter(
                Location.location_type == "city",
                Location.is_deleted == False, Location.is_active == True
            ).all()

            predictions = []
            for city in cities:
                existing = db.query(Company).filter(
                    Company.city == city.name, Company.is_deleted == False
                ).count()
                new_week = db.query(Company).filter(
                    Company.city == city.name, Company.is_deleted == False,
                    Company.created_at > week_ago
                ).count()
                density = existing / max(1, 1)
                growth = new_week / max(existing, 1)
                has_campaign = db.query(CampaignJob).filter(
                    CampaignJob.city_name == city.name,
                    CampaignJob.is_deleted == False
                ).count() > 0

                potential = round(
                    (min(city.population or 500000, 5000000) / 5000000 * 30) +
                    (growth * 20 if existing > 0 else 10) +
                    (city.gdp_usd or 0) / 100000000000 * 20 +
                    (10 if not has_campaign else 0) +
                    (10 if existing < 50 else 0), 1
                )
                confidence = min(0.95, round(
                    (0.3 if existing > 0 else 0.1) +
                    (0.3 if city.latitude else 0) +
                    (0.2 if city.population else 0.1) +
                    0.2, 2
                ))

                predictions.append({
                    "city": city.name,
                    "country_code": city.country_code,
                    "population": city.population or 0,
                    "existing_companies": existing,
                    "growth_rate": round(growth * 100, 1),
                    "has_campaign": has_campaign,
                    "potential_score": potential,
                    "confidence": confidence,
                })

            predictions.sort(key=lambda x: x["potential_score"], reverse=True)

            industries = db.query(Industry).filter(
                Industry.is_deleted == False, Industry.is_active == True,
                Industry.parent_id.isnot(None)
            ).all()

            ind_predictions = []
            for ind in industries:
                companies = db.query(Company).filter(
                    Company.industry == ind.name, Company.is_deleted == False
                ).count()
                new_week = db.query(Company).filter(
                    Company.industry == ind.name, Company.is_deleted == False,
                    Company.created_at > week_ago
                ).count()
                has_campaign = db.query(CampaignJob).filter(
                    CampaignJob.industry_name == ind.name,
                    CampaignJob.is_deleted == False
                ).count() > 0

                ind_predictions.append({
                    "industry": ind.name,
                    "existing_companies": companies,
                    "growth_rate": round(new_week / max(companies, 1) * 100, 1),
                    "has_campaign": has_campaign,
                    "potential_score": round(
                        (min(companies, 500) / 500 * 40) +
                        (10 if not has_campaign else 0) +
                        (min(new_week, 10) * 5), 1
                    ),
                    "confidence": min(0.9, round(0.2 + (0.3 if companies > 0 else 0) + 0.2, 2)),
                })

            ind_predictions.sort(key=lambda x: x["potential_score"], reverse=True)

            next_campaigns = []
            for p in predictions[:5]:
                next_campaigns.append({
                    "name": f"Discover {p['city']}",
                    "location": f"{p['city']}, {p['country_code']}",
                    "expected_results": max(p["existing_companies"], 20),
                    "estimated_cost": round(max(p["existing_companies"], 20) * 0.05, 2),
                    "estimated_runtime_hours": round(max(p["existing_companies"], 20) * 0.002, 1),
                    "confidence": p["confidence"],
                    "reasoning": f"High potential ({p['potential_score']:.0f}/100), pop {p['population']:,}",
                })

            return {
                "top_locations": predictions[:20],
                "top_industries": ind_predictions[:15],
                "recommended_campaigns": next_campaigns,
            }

    # ─── MODULE 7: Self-Optimising Pipeline ─────────────────────────

    def get_pipeline_optimizations(self) -> Dict:
        with get_db_context() as db:
            total_queued = db.query(CampaignJob).filter(
                CampaignJob.status == "queued", CampaignJob.is_deleted == False
            ).count()
            total_running = db.query(CampaignJob).filter(
                CampaignJob.status == "running", CampaignJob.is_deleted == False
            ).count()
            total_completed = db.query(CampaignJob).filter(
                CampaignJob.status == "completed", CampaignJob.is_deleted == False
            ).count()
            total_failed = db.query(CampaignJob).filter(
                CampaignJob.status == "failed", CampaignJob.is_deleted == False
            ).count()

            total = total_queued + total_running + total_completed + total_failed
            success_rate = round(total_completed / max(total_completed + total_failed, 1), 3)
            failure_rate = round(total_failed / max(total, 1), 3)

            avg_runtime = db.query(CampaignJob).filter(
                CampaignJob.runtime_ms.isnot(None),
                CampaignJob.is_deleted == False
            ).all()
            avg_runtime_ms = sum(j.runtime_ms or 0 for j in avg_runtime) / max(len(avg_runtime), 1)

            errors = db.query(CampaignJob.error_message).filter(
                CampaignJob.status == "failed",
                CampaignJob.error_message.isnot(None),
                CampaignJob.is_deleted == False
            ).all()
            error_counts = {}
            for (msg,) in errors:
                key = (msg or "")[:100]
                error_counts[key] = error_counts.get(key, 0) + 1
            top_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]

            recommendations = []
            if failure_rate > 0.3:
                recommendations.append({
                    "title": "High failure rate detected",
                    "description": f"{failure_rate:.0%} failure rate. Review provider health and reduce concurrency.",
                    "confidence": 0.9, "priority": 9,
                })
            if total_queued > total_running * 10:
                recommendations.append({
                    "title": "Queue backlog growing",
                    "description": f"{total_queued} queued vs {total_running} running. Increase concurrency.",
                    "confidence": 0.85, "priority": 8,
                })
            if avg_runtime_ms > 60000:
                recommendations.append({
                    "title": "Jobs running slowly",
                    "description": f"Avg runtime {avg_runtime_ms/1000:.0f}s. Check provider latency.",
                    "confidence": 0.8, "priority": 7,
                })
            if success_rate > 0.95:
                recommendations.append({
                    "title": "High success rate - consider increasing throughput",
                    "description": f"{success_rate:.0%} success rate. Safe to increase concurrency.",
                    "confidence": 0.75, "priority": 5,
                })

            return {
                "queue": {
                    "queued": total_queued,
                    "running": total_running,
                    "completed": total_completed,
                    "failed": total_failed,
                    "total": total,
                },
                "metrics": {
                    "success_rate": success_rate,
                    "failure_rate": failure_rate,
                    "avg_runtime_ms": round(avg_runtime_ms),
                },
                "top_errors": [{"error": e, "count": c} for e, c in top_errors],
                "recommendations": recommendations,
            }

    # ─── MODULE 8: Discovery Economics ──────────────────────────────

    def get_economics_data(self) -> Dict:
        with get_db_context() as db:
            from sqlalchemy import func

            total_companies = db.query(Company).filter(Company.is_deleted == False).count()
            total_leads = db.query(Lead).filter(Lead.is_deleted == False).count()
            total_opportunities = db.query(Opportunity).filter(Opportunity.is_deleted == False).count()

            campaigns = db.query(DiscoveryCampaign).filter(
                DiscoveryCampaign.is_deleted == False
            ).all()

            total_businesses = sum(c.total_businesses or 0 for c in campaigns)
            total_unique = sum(c.unique_businesses or 0 for c in campaigns)
            total_provider_requests = sum(c.provider_requests or 0 for c in campaigns)
            total_ai_requests = sum(c.ai_requests or 0 for c in campaigns)
            total_cost = sum(c.estimated_cost_usd or 0 for c in campaigns)

            cost_per_discovered = round(total_cost / max(total_companies, 1), 4)
            cost_per_enriched = round(total_cost / max(total_unique, 1), 4)
            cost_per_proposal = round(total_cost / max(total_opportunities, 1), 4)

            total_search_jobs = db.query(SearchJob).filter(
                SearchJob.is_deleted == False
            ).count()

            total_audits = db.query(Audit).filter(Audit.is_deleted == False).count()

            return {
                "totals": {
                    "companies": total_companies,
                    "leads": total_leads,
                    "opportunities": total_opportunities,
                    "search_jobs": total_search_jobs,
                    "audits": total_audits,
                    "businesses_discovered": total_businesses,
                },
                "costs": {
                    "total_cost_usd": round(total_cost, 2),
                    "cost_per_company": cost_per_discovered,
                    "cost_per_enriched": cost_per_enriched,
                    "cost_per_proposal": cost_per_proposal,
                    "provider_requests": total_provider_requests,
                    "ai_requests": total_ai_requests,
                },
                "efficiency": {
                    "dedup_rate": round(1 - total_unique / max(total_businesses, 1), 3),
                    "enrichment_rate": round(total_unique / max(total_businesses, 1), 3),
                    "proposal_rate": round(total_opportunities / max(total_leads, 1), 3),
                },
            }

    # ─── MODULE 9: Global Benchmarks ────────────────────────────────

    def get_benchmarks(self) -> Dict:
        with get_db_context() as db:
            countries = db.query(Location).filter(
                Location.location_type == "country",
                Location.is_deleted == False, Location.is_active == True
            ).all()

            country_benchmarks = []
            for country in countries:
                companies = db.query(Company).filter(
                    Company.country == country.country_code,
                    Company.is_deleted == False
                ).all()
                if not companies:
                    continue

                company_ids = [str(c.id) for c in companies[:50]]
                from worker.models import Audit as A, Website as W
                audits = db.query(A).join(W).filter(
                    W.company_id.in_(company_ids) if company_ids else False,
                    A.is_deleted == False
                ).all() if company_ids else []

                website_scores = [a.overall_score for a in audits if a.overall_score]
                seo_scores = [a.seo_score for a in audits if a.seo_score]
                design_scores = [a.design_score for a in audits if a.design_score]
                perf_scores = [a.performance_score for a in audits if a.performance_score]

                ratings = [c.rating for c in companies if c.rating]
                reviews = [c.review_count for c in companies if c.review_count]

                country_benchmarks.append({
                    "entity": country.name,
                    "country_code": country.country_code,
                    "total_companies": len(companies),
                    "avg_website_score": round(sum(website_scores) / max(len(website_scores), 1), 1),
                    "avg_seo_score": round(sum(seo_scores) / max(len(seo_scores), 1), 1),
                    "avg_design_score": round(sum(design_scores) / max(len(design_scores), 1), 1),
                    "avg_performance_score": round(sum(perf_scores) / max(len(perf_scores), 1), 1),
                    "avg_rating": round(sum(ratings) / max(len(ratings), 1), 2),
                    "avg_review_count": round(sum(reviews) / max(len(reviews), 1), 0),
                })

            country_benchmarks.sort(key=lambda x: x["total_companies"], reverse=True)

            industries = db.query(Industry).filter(
                Industry.is_deleted == False, Industry.is_active == True,
                Industry.parent_id.isnot(None)
            ).all()

            industry_benchmarks = []
            for ind in industries:
                companies = db.query(Company).filter(
                    Company.industry == ind.name, Company.is_deleted == False
                ).all()
                if not companies:
                    continue

                company_ids = [str(c.id) for c in companies[:50]]
                from worker.models import Audit as A, Website as W
                audits = db.query(A).join(W).filter(
                    W.company_id.in_(company_ids) if company_ids else False,
                    A.is_deleted == False
                ).all() if company_ids else []

                website_scores = [a.overall_score for a in audits if a.overall_score]
                ratings = [c.rating for c in companies if c.rating]

                industry_benchmarks.append({
                    "entity": ind.name,
                    "total_companies": len(companies),
                    "avg_website_score": round(sum(website_scores) / max(len(website_scores), 1), 1),
                    "avg_rating": round(sum(ratings) / max(len(ratings), 1), 2),
                })

            industry_benchmarks.sort(key=lambda x: x["total_companies"], reverse=True)

            return {
                "country_benchmarks": country_benchmarks,
                "industry_benchmarks": industry_benchmarks,
            }

    # ─── MODULE 10: Executive AI ────────────────────────────────────

    def generate_executive_report(self) -> Dict:
        discovery = self.get_discovery_intelligence()
        providers = self.get_provider_intelligence()
        market = self.get_market_intelligence()
        opportunities = self.get_opportunity_intelligence()
        pipeline = self.get_pipeline_optimizations()
        economics = self.get_economics_data()
        predictive = self.get_predictive_discovery()

        top_opps = opportunities.get("top_opportunities", [])[:100]
        top_cities = market.get("fastest_growing_cities", [])[:10]
        top_industries = market.get("top_industries_by_volume", [])[:10]

        all_recs = []
        all_recs.extend(discovery.get("recommendations", []))
        all_recs.extend(providers.get("recommendations", []))
        all_recs.extend(pipeline.get("recommendations", []))
        all_recs.sort(key=lambda x: x.get("priority", 0), reverse=True)

        summary_parts = []
        s = discovery.get("summary", {})
        summary_parts.append(f"{s.get('total_companies', 0)} companies across {s.get('countries_with_data', 0)} countries")
        t = discovery.get("trends", {})
        summary_parts.append(f"{t.get('new_this_week', 0)} new this week ({t.get('velocity_per_day', 0):.0f}/day)")
        summary_parts.append(f"Success rate: {pipeline.get('metrics', {}).get('success_rate', 0):.0%}")
        summary_parts.append(f"Cost: ${economics.get('costs', {}).get('total_cost_usd', 0):.2f}")

        return {
            "title": f"Executive Intelligence Report — {datetime.utcnow().strftime('%B %d, %Y')}",
            "summary": ". ".join(summary_parts),
            "discovery": discovery,
            "providers": providers,
            "market": market,
            "opportunities": {
                "total_scored": opportunities.get("total_scored", 0),
                "top_100": top_opps,
                "summary": opportunities.get("summary", {}),
            },
            "pipeline": pipeline,
            "economics": economics,
            "predictive": predictive,
            "top_cities": top_cities,
            "top_industries": top_industries,
            "recommendations": all_recs[:20],
        }


intelligence_service = IntelligenceService()
