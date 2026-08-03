"""AI Negotiation Assistant - Module 5."""
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from worker.models.database import get_db_context
from worker.models import (
    Company, Website, Audit, Technology, Contact, Lead,
    Opportunity, NegotiationProfile, CompetitorAnalysis,
)

logger = logging.getLogger(__name__)


class NegotiationAssistantService:
    """Generate negotiation strategies and sales intelligence."""

    def generate_profile(self, company_id: str) -> Optional[Dict]:
        with get_db_context() as db:
            company = db.query(Company).filter(
                Company.id == company_id, Company.is_deleted == False
            ).first()
            if not company:
                return None

            website = db.query(Website).filter(Website.company_id == company.id).first()
            audit = None
            if website:
                from worker.models import Audit as A
                audit = db.query(A).filter(A.website_id == website.id).first()

            tech_count = db.query(Technology).filter(Technology.company_id == company.id).count()
            contacts = db.query(Contact).filter(Contact.company_id == company.id).all()
            competitors = db.query(CompetitorAnalysis).filter(
                CompetitorAnalysis.company_id == company.id
            ).all()

            lead = db.query(Lead).filter(
                Lead.company_id == company.id, Lead.is_deleted == False
            ).first()
            opportunity = None
            if lead:
                from worker.models import Opportunity as O
                opportunity = db.query(O).filter(O.lead_id == lead.id).first()

            objections = self._generate_objections(company, website, audit, competitors)
            talking_points = self._generate_talking_points(company, website, audit, tech_count)
            pricing = self._generate_pricing_strategy(company, opportunity, audit)
            upsell = self._generate_upsell(company, website, audit, tech_count)
            cross_sell = self._generate_cross_sell(company, website, audit)
            agenda = self._generate_meeting_agenda(company, contacts, audit)
            closing = self._generate_closing_strategy(company, opportunity, audit)
            comp_weak = self._generate_competitor_weaknesses(competitors)
            services = self._recommend_services(company, website, audit, tech_count)

            existing = db.query(NegotiationProfile).filter(
                NegotiationProfile.company_id == company.id,
                NegotiationProfile.is_deleted == False
            ).first()

            data = dict(
                company_id=company.id,
                likely_objections=objections,
                talking_points=talking_points,
                pricing_strategy=pricing,
                upsell_opportunities=upsell,
                cross_sell_opportunities=cross_sell,
                meeting_agenda=agenda,
                closing_strategy=closing,
                competitor_weaknesses=comp_weak,
                recommended_services=services,
                ai_model="rule_based_v1",
                raw_ai_response={},
            )

            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(NegotiationProfile(**data))

            db.commit()
            return self._serialize(data, str(company.id), company.name)

    def get_profile(self, company_id: str) -> Optional[Dict]:
        with get_db_context() as db:
            profile = db.query(NegotiationProfile).filter(
                NegotiationProfile.company_id == company_id,
                NegotiationProfile.is_deleted == False
            ).first()
            if not profile:
                return self.generate_profile(company_id)
            company = db.query(Company).filter(Company.id == company_id).first()
            return self._serialize({
                "company_id": str(profile.company_id),
                "likely_objections": profile.likely_objections,
                "talking_points": profile.talking_points,
                "pricing_strategy": profile.pricing_strategy,
                "upsell_opportunities": profile.upsell_opportunities,
                "cross_sell_opportunities": profile.cross_sell_opportunities,
                "meeting_agenda": profile.meeting_agenda,
                "closing_strategy": profile.closing_strategy,
                "competitor_weaknesses": profile.competitor_weaknesses,
                "recommended_services": profile.recommended_services,
            }, company_id, company.name if company else "")

    def _serialize(self, data, company_id, company_name):
        data["company_id"] = company_id
        data["company_name"] = company_name
        return data

    def _generate_objections(self, company, website, audit, competitors):
        objections = []
        if company.website and audit and audit.overall_score and audit.overall_score > 60:
            objections.append({
                "objection": "Our website is already performing well",
                "response": f"While your score is {audit.overall_score}/100, competitors are averaging higher. Here's a competitive analysis...",
                "confidence": 0.7,
            })
        if not company.website:
            objections.append({
                "objection": "We don't need a website",
                "response": "87% of customers research online before buying. Without a digital presence, you're invisible to potential clients.",
                "confidence": 0.9,
            })
        objections.append({
            "objection": "We're too busy to focus on marketing",
            "response": "That's exactly why our automated solutions work - they run in the background while you focus on your business.",
            "confidence": 0.8,
        })
        if company.review_count and company.review_count > 50:
            objections.append({
                "objection": "We already have plenty of customers",
                "response": f"With {company.review_count} reviews, you have a strong foundation. Let's amplify that with targeted campaigns to attract premium clients.",
                "confidence": 0.75,
            })
        return objections

    def _generate_talking_points(self, company, website, audit, tech_count):
        points = []
        if audit and audit.overall_score and audit.overall_score < 50:
            points.append(f"Your website scores {audit.overall_score}/100 - we can get you to 80+")
        if audit and audit.seo_score and audit.seo_score < 50:
            points.append(f"SEO score is {audit.seo_score}/100 - massive untapped potential")
        if tech_count == 0:
            points.append("No detected technology stack - opportunity to build from scratch")
        if company.rating and company.rating >= 4.0:
            points.append(f"Excellent {company.rating} star rating - let's leverage this in marketing")
        if company.review_count and company.review_count > 100:
            points.append(f"{company.review_count} reviews - strong social proof to build on")
        points.append(f"We specialise in {company.industry or 'your industry'} businesses")
        return points

    def _generate_pricing_strategy(self, company, opportunity, audit):
        strategy = {"tier": "standard", "approach": "value_based"}
        if opportunity and opportunity.total_max and opportunity.total_max > 25000:
            strategy = {
                "tier": "premium",
                "approach": "consultative",
                "anchor_price": f"${opportunity.total_max:,}",
                "discount_authorised": "10%",
                "payment_terms": "30% upfront, 40% mid-project, 30% on completion",
            }
        elif audit and audit.overall_score and audit.overall_score < 40:
            strategy = {
                "tier": "starter",
                "approach": "quick_wins",
                "anchor_price": "$5,000",
                "discount_authorised": "15%",
                "payment_terms": "50% upfront, 50% on completion",
            }
        else:
            strategy = {
                "tier": "professional",
                "approach": "roi_focused",
                "anchor_price": "$15,000",
                "discount_authorised": "10%",
                "payment_terms": "40% upfront, 30% mid-project, 30% on completion",
            }
        return strategy

    def _generate_upsell(self, company, website, audit, tech_count):
        upsell = []
        if audit and audit.seo_score and audit.seo_score < 60:
            upsell.append({"service": "SEO Optimisation", "reason": f"Current SEO score: {audit.seo_score}/100", "est_value": "$3,000-8,000"})
        if audit and audit.performance_score and audit.performance_score < 60:
            upsell.append({"service": "Performance Optimisation", "reason": f"Current performance: {audit.performance_score}/100", "est_value": "$2,000-5,000"})
        if tech_count < 3:
            upsell.append({"service": "Analytics & Tracking Setup", "reason": "Limited technology stack", "est_value": "$1,500-3,000"})
        if not website or not website.instagram:
            upsell.append({"service": "Social Media Strategy", "reason": "No social media presence detected", "est_value": "$2,000-6,000"})
        return upsell

    def _generate_cross_sell(self, company, website, audit):
        cross = []
        cross.append({"service": "Google Business Profile Optimisation", "reason": "Local SEO improvement"})
        cross.append({"service": "Content Marketing", "reason": "Thought leadership and authority building"})
        if website and website.instagram:
            cross.append({"service": "Instagram Growth Strategy", "reason": "Leverage existing social presence"})
        cross.append({"service": "Email Marketing Automation", "reason": "Customer retention and nurturing"})
        return cross

    def _generate_meeting_agenda(self, company, contacts, audit):
        agenda = [
            {"time": "0-5 min", "item": "Introduction and relationship building"},
            {"time": "5-15 min", "item": f"Review {company.name}'s current digital presence"},
            {"time": "15-25 min", "item": "Present audit findings and competitive analysis"},
            {"time": "25-35 min", "item": "Discuss business goals and challenges"},
            {"time": "35-45 min", "item": "Propose tailored solutions with ROI projections"},
            {"time": "45-55 min", "item": "Address objections and questions"},
            {"time": "55-60 min", "item": "Agree on next steps and timeline"},
        ]
        if audit and audit.overall_score and audit.overall_score < 50:
            agenda[2]["item"] = f"Highlight critical website issues (score: {audit.overall_score}/100)"
        return agenda

    def _generate_closing_strategy(self, company, opportunity, audit):
        if opportunity and opportunity.total_max and opportunity.total_max > 20000:
            return "Consultative close: Focus on ROI and long-term partnership. Offer a phased approach with measurable milestones. Provide a detailed business case with expected traffic and conversion improvements."
        if audit and audit.overall_score and audit.overall_score < 40:
            return "Urgency close: Highlight critical issues affecting their business now. Offer a quick-win starter package with immediate visible improvements. Create FOMO with limited-time pricing."
        return "Value close: Present a clear before/after scenario. Use case studies from similar businesses. Offer a money-back guarantee on first deliverable."

    def _generate_competitor_weaknesses(self, competitors):
        weaknesses = []
        for c in competitors:
            if c.weaknesses_vs_competitor:
                for w in (c.weaknesses_vs_competitor or []):
                    weaknesses.append({"competitor": c.competitor_name, "weakness": w})
        return weaknesses[:10]

    def _recommend_services(self, company, website, audit, tech_count):
        services = []
        if not company.website:
            services.append({"service": "Website Design & Development", "priority": "high", "reason": "No website"})
        elif audit:
            if audit.overall_score and audit.overall_score < 50:
                services.append({"service": "Website Redesign", "priority": "high", "reason": f"Score {audit.overall_score}/100"})
            if audit.seo_score and audit.seo_score < 50:
                services.append({"service": "SEO Services", "priority": "high", "reason": f"SEO score {audit.seo_score}/100"})
            if audit.design_score and audit.design_score < 50:
                services.append({"service": "UI/UX Redesign", "priority": "medium", "reason": f"Design score {audit.design_score}/100"})
        if tech_count < 2:
            services.append({"service": "Analytics & Tracking", "priority": "medium", "reason": "Limited tech stack"})
        services.append({"service": "Digital Strategy Consulting", "priority": "low", "reason": "Strategic planning"})
        return services


negotiation_service = NegotiationAssistantService()
