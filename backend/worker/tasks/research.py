"""Research task - AI-powered company intelligence generation."""
import asyncio
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import (
    Company, Website, Audit, Technology, CompanyResearch,
    CompetitorAnalysis, Report, SearchJob, SearchResult, Lead
)

logger = logging.getLogger(__name__)


RESEARCH_PROMPT_TEMPLATE = """Analyze this company and provide comprehensive intelligence:

Company: {company_name}
Industry: {industry}
City: {city}
Country: {country}
Website: {website}
Rating: {rating}/5 ({review_count} reviews)
Description: {description}

Technology Stack: {tech_stack}
Services Listed: {services}

Website Audit Scores:
- Overall: {overall_score}/100
- SEO: {seo_score}/100
- Performance: {performance_score}/100
- Design: {design_score}/100
- Conversion: {conversion_score}/100
- Trust: {trust_score}/100

Weaknesses: {weaknesses}
Quick Wins: {quick_wins}

Provide a comprehensive analysis in this JSON format:
{{
    "business_summary": "2-3 sentence overview of the business",
    "products": ["list of products offered"],
    "services": ["list of services offered"],
    "target_audience": "Who their customers likely are",
    "business_type": "B2B/B2C/Both, type of establishment",
    "unique_selling_points": ["what makes them unique"],
    "growth_indicators": ["signs of growth or opportunity"],
    "likely_pain_points": ["problems they likely face"],
    "website_weaknesses": ["specific website problems found"],
    "recommended_services": ["services we should pitch to them"],
    "sales_talking_points": ["what to say when reaching out"],
    "priority": "high/medium/low based on opportunity size",
    "estimated_budget": "estimated budget range for our services in local currency",
    "estimated_company_size": "Small(1-10)/Medium(11-50)/Large(51-200)/Enterprise(200+)",
    "confidence_score": 0.0-1.0 how confident we are in this analysis
}}"""


COMPETITOR_PROMPT_TEMPLATE = """Analyze competitors for this company and provide competitive intelligence:

Company: {company_name}
Industry: {industry}
City: {city}
Country: {country}
Website: {website}
Rating: {rating}/5 ({review_count} reviews)

Technology Stack: {tech_stack}
Services Listed: {services}

Website Audit Scores:
- Overall: {overall_score}/100
- SEO: {seo_score}/100
- Performance: {performance_score}/100
- Design: {design_score}/100
- Conversion: {conversion_score}/100

Provide a competitive analysis in this JSON format:
{{
    "competitors": [
        {{
            "name": "Competitor Name",
            "website": "competitor.com",
            "strengths": ["what they do well"],
            "weaknesses": ["where they fall short"],
            "pricing_estimate": "estimated pricing range",
            "market_position": "leader/challenger/niche"
        }}
    ],
    "market_position": "leader/challenger/niche/newcomer for our company",
    "strengths_vs_competitors": ["our competitive advantages"],
    "weaknesses_vs_competitors": ["where competitors beat us"],
    "opportunity_gaps": ["market gaps we can exploit"],
    "recommended_positioning": "how to position our services"
}}"""


REPORT_PROMPT_TEMPLATE = """Generate a {report_type} report for the period {period_start} to {period_end}.

Data summary:
- Total companies found: {total_companies}
- Total leads created: {total_leads}
- Average audit score: {avg_score}
- Top industries: {top_industries}
- Top cities: {top_cities}
- High priority leads: {high_priority}

Generate a comprehensive report in this JSON format:
{{
    "title": "Report Title",
    "summary": "Executive summary paragraph",
    "key_findings": ["finding 1", "finding 2"],
    "metrics": {{
        "total_companies": 0,
        "total_leads": 0,
        "avg_audit_score": 0,
        "conversion_rate": "0%"
    }},
    "recommendations": ["recommendation 1", "recommendation 2"],
    "trends": ["trend 1", "trend 2"]
}}"""


def _get_company_context(db, company):
    """Helper to build company context for prompts."""
    website = db.query(Website).filter(Website.company_id == company.id).first()
    techs = db.query(Technology).filter(Technology.company_id == company.id).all()
    audit = None
    if website:
        audit = db.query(Audit).filter(Audit.website_id == website.id).first()

    return {
        "website": website,
        "techs": techs,
        "audit": audit,
        "tech_stack": ", ".join([t.name for t in techs]) if techs else "Not detected",
        "services": ", ".join(website.services) if website and website.services else "Not listed",
        "weaknesses": ", ".join(audit.weaknesses) if audit and audit.weaknesses else "None identified",
        "quick_wins": ", ".join(audit.quick_wins) if audit and audit.quick_wins else "None identified",
    }


@app.task(bind=True, name="worker.tasks.research.research_company")
def research_company(self, company_id: str):
    """Generate AI research intelligence for a company."""
    logger.info(f"Researching company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return

        existing_research = db.query(CompanyResearch).filter(
            CompanyResearch.company_id == company_id,
            CompanyResearch.is_deleted == False
        ).first()
        if existing_research:
            logger.info(f"Research already exists for {company.name}, skipping")
            return

        ctx = _get_company_context(db, company)

        prompt = RESEARCH_PROMPT_TEMPLATE.format(
            company_name=company.name,
            industry=company.industry or "Unknown",
            city=company.city or "Unknown",
            country=company.country or "Unknown",
            website=company.website or "No website",
            rating=company.rating or 0,
            review_count=company.review_count or 0,
            description=company.description or "No description",
            tech_stack=ctx["tech_stack"],
            services=ctx["services"],
            overall_score=ctx["audit"].overall_score if ctx["audit"] else "N/A",
            seo_score=ctx["audit"].seo_score if ctx["audit"] else "N/A",
            performance_score=ctx["audit"].performance_score if ctx["audit"] else "N/A",
            design_score=ctx["audit"].design_score if ctx["audit"] else "N/A",
            conversion_score=ctx["audit"].conversion_score if ctx["audit"] else "N/A",
            trust_score=ctx["audit"].trust_score if ctx["audit"] else "N/A",
            weaknesses=ctx["weaknesses"],
            quick_wins=ctx["quick_wins"],
        )

        try:
            self.update_state(state="PROGRESS", meta={"stage": "ai_analysis", "progress": 50})

            from worker.services.ai_client import ai_client
            response = asyncio.run(ai_client.generate_json(prompt))

            if response.get("parse_error"):
                logger.warning(f"AI returned unparseable response for {company.name}")
                research = CompanyResearch(
                    company_id=company_id,
                    business_summary=response.get("raw_response", "")[:1000],
                    confidence_score=0.1,
                    ai_model=ai_client.model,
                    raw_ai_response=response,
                )
            else:
                research = CompanyResearch(
                    company_id=company_id,
                    business_summary=response.get("business_summary", ""),
                    products=response.get("products", []),
                    services=response.get("services", []),
                    target_audience=response.get("target_audience", ""),
                    business_type=response.get("business_type", ""),
                    unique_selling_points=response.get("unique_selling_points", []),
                    growth_indicators=response.get("growth_indicators", []),
                    likely_pain_points=response.get("likely_pain_points", []),
                    website_weaknesses=response.get("website_weaknesses", []),
                    recommended_services=response.get("recommended_services", []),
                    sales_talking_points=response.get("sales_talking_points", []),
                    priority=response.get("priority", "medium"),
                    estimated_budget=response.get("estimated_budget", ""),
                    estimated_company_size=response.get("estimated_company_size", ""),
                    confidence_score=float(response.get("confidence_score", 0.5)),
                    ai_model=ai_client.model,
                    raw_ai_response=response,
                )

            db.add(research)

            logger.info(f"Research completed for {company.name}: priority={research.priority}, confidence={research.confidence_score}")

        except Exception as e:
            logger.error(f"Research failed for {company.name}: {e}")
            db.rollback()
            raise

        self.update_state(state="PROGRESS", meta={"stage": "completed", "progress": 100})


@app.task(bind=True, name="worker.tasks.research.analyze_competitors")
def analyze_competitors(self, company_id: str):
    """Generate AI competitor analysis for a company."""
    logger.info(f"Analyzing competitors for company: {company_id}")

    with get_db_context() as db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.warning(f"Company not found: {company_id}")
            return

        ctx = _get_company_context(db, company)

        prompt = COMPETITOR_PROMPT_TEMPLATE.format(
            company_name=company.name,
            industry=company.industry or "Unknown",
            city=company.city or "Unknown",
            country=company.country or "Unknown",
            website=company.website or "No website",
            rating=company.rating or 0,
            review_count=company.review_count or 0,
            tech_stack=ctx["tech_stack"],
            services=ctx["services"],
            overall_score=ctx["audit"].overall_score if ctx["audit"] else "N/A",
            seo_score=ctx["audit"].seo_score if ctx["audit"] else "N/A",
            performance_score=ctx["audit"].performance_score if ctx["audit"] else "N/A",
            design_score=ctx["audit"].design_score if ctx["audit"] else "N/A",
            conversion_score=ctx["audit"].conversion_score if ctx["audit"] else "N/A",
        )

        try:
            self.update_state(state="PROGRESS", meta={"stage": "ai_analysis", "progress": 50})

            from worker.services.ai_client import ai_client
            response = asyncio.run(ai_client.generate_json(prompt))

            if response.get("parse_error"):
                logger.warning(f"AI returned unparseable response for competitor analysis of {company.name}")
                return

            for comp_data in response.get("competitors", []):
                analysis = CompetitorAnalysis(
                    company_id=company_id,
                    competitor_name=comp_data.get("name", ""),
                    competitor_website=comp_data.get("website", ""),
                    competitor_industry=company.industry,
                    competitor_location=company.city,
                    overall_comparison=f"Strengths: {', '.join(comp_data.get('strengths', []))}. Weaknesses: {', '.join(comp_data.get('weaknesses', []))}",
                    strengths_vs_competitor=comp_data.get("strengths", []),
                    weaknesses_vs_competitor=comp_data.get("weaknesses", []),
                    market_position=comp_data.get("market_position", ""),
                    opportunity_gaps=response.get("opportunity_gaps", []),
                    pricing_comparison={"estimate": comp_data.get("pricing_estimate", "")},
                    ai_model=ai_client.model,
                    raw_ai_response=response,
                )
                db.add(analysis)

            logger.info(f"Competitor analysis completed for {company.name}: {len(response.get('competitors', []))} competitors analyzed")

        except Exception as e:
            logger.error(f"Competitor analysis failed for {company.name}: {e}")
            db.rollback()
            raise

        self.update_state(state="PROGRESS", meta={"stage": "completed", "progress": 100})


@app.task(bind=True, name="worker.tasks.research.generate_report")
def generate_report(self, report_type: str = "summary", period_start: str = None, period_end: str = None, filters: dict = None):
    """Generate an AI-powered report."""
    logger.info(f"Generating {report_type} report")

    with get_db_context() as db:
        try:
            now = datetime.utcnow()
            from datetime import timedelta
            start = datetime.fromisoformat(period_start) if period_start else (now - timedelta(days=30))
            end = datetime.fromisoformat(period_end) if period_end else now

            total_companies = db.query(Company).filter(Company.is_deleted == False).count()
            total_leads = db.query(Lead).filter(Lead.is_deleted == False).count()
            total_searches = db.query(SearchJob).filter(SearchJob.is_deleted == False).count()

            high_priority = db.query(CompanyResearch).filter(
                CompanyResearch.priority == "high",
                CompanyResearch.is_deleted == False,
            ).count()

            from sqlalchemy import func
            avg_score_result = db.query(func.avg(Lead.score)).filter(Lead.is_deleted == False).scalar()
            avg_score = round(float(avg_score_result or 0), 1)

            top_industries_result = db.query(Company.industry, func.count(Company.id)).filter(
                Company.is_deleted == False, Company.industry.isnot(None), Company.industry != ''
            ).group_by(Company.industry).order_by(func.count(Company.id).desc()).limit(5).all()
            top_industries = ", ".join([f"{i[0]} ({i[1]})" for i in top_industries_result]) or "N/A"

            top_cities_result = db.query(Company.city, func.count(Company.id)).filter(
                Company.is_deleted == False, Company.city.isnot(None), Company.city != ''
            ).group_by(Company.city).order_by(func.count(Company.id).desc()).limit(5).all()
            top_cities = ", ".join([f"{c[0]} ({c[1]})" for c in top_cities_result]) or "N/A"

            prompt = REPORT_PROMPT_TEMPLATE.format(
                report_type=report_type,
                period_start=start.strftime("%Y-%m-%d"),
                period_end=end.strftime("%Y-%m-%d"),
                total_companies=total_companies,
                total_leads=total_leads,
                avg_score=avg_score,
                top_industries=top_industries,
                top_cities=top_cities,
                high_priority=high_priority,
            )

            self.update_state(state="PROGRESS", meta={"stage": "ai_generation", "progress": 50})

            from worker.services.ai_client import ai_client
            response = asyncio.run(ai_client.generate_json(prompt))

            if response.get("parse_error"):
                data = {
                    "title": f"{report_type.title()} Report",
                    "summary": f"Report covering {start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}",
                    "total_companies": total_companies,
                    "total_leads": total_leads,
                    "total_searches": total_searches,
                }
            else:
                data = response
                data["total_companies"] = total_companies
                data["total_leads"] = total_leads
                data["total_searches"] = total_searches

            report = Report(
                title=data.get("title", f"{report_type.title()} Report"),
                report_type=report_type,
                status="completed",
                data=data,
                period_start=start,
                period_end=end,
                generated_by_ai=True,
                ai_model=ai_client.model if not response.get("parse_error") else None,
            )
            db.add(report)

            logger.info(f"Report generated: {report.title} (ID: {report.id})")
            return {"report_id": str(report.id), "title": report.title}

        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            db.rollback()
            raise

        self.update_state(state="PROGRESS", meta={"stage": "completed", "progress": 100})
