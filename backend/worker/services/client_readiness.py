"""Client Readiness Score - Module 4."""
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from worker.models.database import get_db_context
from worker.models import (
    Company, Website, Audit, Technology, Contact, Lead,
    Opportunity, ClientReadinessScore,
)

logger = logging.getLogger(__name__)


class ClientReadinessService:
    """Compute multi-dimensional client readiness scores."""

    def compute_for_company(self, company_id: str) -> Optional[Dict]:
        with get_db_context() as db:
            company = db.query(Company).filter(
                Company.id == company_id, Company.is_deleted == False
            ).first()
            if not company:
                return None

            website = db.query(Website).filter(
                Website.company_id == company.id
            ).first()
            audit = None
            if website:
                from worker.models import Audit as A
                audit = db.query(A).filter(A.website_id == website.id).first()

            tech_count = db.query(Technology).filter(
                Technology.company_id == company.id
            ).count()

            contacts = db.query(Contact).filter(
                Contact.company_id == company.id
            ).all()

            lead = db.query(Lead).filter(
                Lead.company_id == company.id, Lead.is_deleted == False
            ).first()

            opportunity = None
            if lead:
                from worker.models import Opportunity as O
                opportunity = db.query(O).filter(O.lead_id == lead.id).first()

            budget_score, budget_reasoning = self._compute_budget(company, opportunity, website)
            urgency_score, urgency_reasoning = self._compute_urgency(company, website, audit)
            growth_score, growth_reasoning = self._compute_growth(company, website, tech_count)
            dm_score, dm_reasoning = self._compute_decision_maker(contacts, company)
            digital_score, digital_reasoning = self._compute_digital_maturity(company, website, audit, tech_count)
            sales_score, sales_reasoning = self._compute_sales_readiness(company, website, contacts)
            ai_score, ai_reasoning = self._compute_ai_adoption(website, tech_count)

            overall = round(
                budget_score * 0.2 + urgency_score * 0.15 + growth_score * 0.15 +
                dm_score * 0.15 + digital_score * 0.1 + sales_score * 0.1 + ai_score * 0.05, 1
            )

            action = self._recommend_action(overall, budget_score, urgency_score, digital_score)
            outreach = self._recommend_outreach(contacts, company, overall)
            proposal_type = self._recommend_proposal_type(overall, digital_score, company)
            pricing = self._recommend_pricing(opportunity, company, overall)
            followup = self._recommend_followup(overall, urgency_score, sales_score)

            existing = db.query(ClientReadinessScore).filter(
                ClientReadinessScore.company_id == company.id,
                ClientReadinessScore.is_deleted == False
            ).first()

            data = dict(
                company_id=company.id,
                budget_score=budget_score, budget_reasoning=budget_reasoning,
                urgency_score=urgency_score, urgency_reasoning=urgency_reasoning,
                growth_score=growth_score, growth_reasoning=growth_reasoning,
                decision_maker_score=dm_score, decision_maker_reasoning=dm_reasoning,
                digital_maturity=digital_score, digital_maturity_reasoning=digital_reasoning,
                sales_readiness=sales_score, sales_readiness_reasoning=sales_reasoning,
                ai_adoption=ai_score, ai_adoption_reasoning=ai_reasoning,
                overall_readiness=overall,
                recommended_action=action,
                recommended_outreach=outreach,
                recommended_proposal_type=proposal_type,
                recommended_pricing_range=pricing,
                follow_up_strategy=followup,
                computed_at=datetime.now(timezone.utc),
            )

            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(ClientReadinessScore(**data))

            db.commit()
            return data

    def compute_all(self, limit: int = 200) -> int:
        with get_db_context() as db:
            companies = db.query(Company).filter(
                Company.is_deleted == False
            ).limit(limit).all()
            count = 0
            for c in companies:
                try:
                    self.compute_for_company(str(c.id))
                    count += 1
                except Exception as e:
                    logger.warning(f"Failed to compute readiness for {c.id}: {e}")
            return count

    def get_score(self, company_id: str) -> Optional[Dict]:
        with get_db_context() as db:
            score = db.query(ClientReadinessScore).filter(
                ClientReadinessScore.company_id == company_id,
                ClientReadinessScore.is_deleted == False
            ).first()
            if not score:
                return self.compute_for_company(company_id)
            return {
                "company_id": str(score.company_id),
                "budget_score": score.budget_score,
                "budget_reasoning": score.budget_reasoning,
                "urgency_score": score.urgency_score,
                "urgency_reasoning": score.urgency_reasoning,
                "growth_score": score.growth_score,
                "growth_reasoning": score.growth_reasoning,
                "decision_maker_score": score.decision_maker_score,
                "decision_maker_reasoning": score.decision_maker_reasoning,
                "digital_maturity": score.digital_maturity,
                "digital_maturity_reasoning": score.digital_maturity_reasoning,
                "sales_readiness": score.sales_readiness,
                "sales_readiness_reasoning": score.sales_readiness_reasoning,
                "ai_adoption": score.ai_adoption,
                "ai_adoption_reasoning": score.ai_adoption_reasoning,
                "overall_readiness": score.overall_readiness,
                "recommended_action": score.recommended_action,
                "recommended_outreach": score.recommended_outreach,
                "recommended_proposal_type": score.recommended_proposal_type,
                "recommended_pricing_range": score.recommended_pricing_range,
                "follow_up_strategy": score.follow_up_strategy,
                "computed_at": score.computed_at.isoformat() if score.computed_at else None,
            }

    def get_top_prospects(self, limit: int = 50) -> list:
        with get_db_context() as db:
            scores = db.query(ClientReadinessScore).filter(
                ClientReadinessScore.is_deleted == False,
                ClientReadinessScore.overall_readiness > 0
            ).order_by(ClientReadinessScore.overall_readiness.desc()).limit(limit).all()

            result = []
            for s in scores:
                company = db.query(Company).filter(Company.id == s.company_id).first()
                if company:
                    result.append({
                        "company_id": str(s.company_id),
                        "company_name": company.name,
                        "industry": company.industry or "",
                        "city": company.city or "",
                        "country": company.country or "",
                        "overall_readiness": s.overall_readiness,
                        "budget_score": s.budget_score,
                        "urgency_score": s.urgency_score,
                        "growth_score": s.growth_score,
                        "digital_maturity": s.digital_maturity,
                        "sales_readiness": s.sales_readiness,
                        "recommended_action": s.recommended_action,
                        "recommended_pricing_range": s.recommended_pricing_range,
                        "computed_at": s.computed_at.isoformat() if s.computed_at else None,
                    })
            return result

    # ─── Scoring Methods ─────────────────────────────────────────────

    def _compute_budget(self, company, opportunity, website):
        score = 30
        reasoning_parts = []
        if company.employee_count and company.employee_count > 50:
            score += 20
            reasoning_parts.append(f"Large team ({company.employee_count} employees)")
        elif company.employee_count and company.employee_count > 10:
            score += 10
            reasoning_parts.append(f"Medium team ({company.employee_count} employees)")
        if company.founded_year and (2024 - company.founded_year) > 5:
            score += 15
            reasoning_parts.append(f"Established ({2024 - company.founded_year} years)")
        if company.website:
            score += 5
        if opportunity and opportunity.total_max and opportunity.total_max > 10000:
            score += 15
            reasoning_parts.append(f"High opportunity value (${opportunity.total_max:,})")
        if company.review_count and company.review_count > 100:
            score += 10
            reasoning_parts.append(f"Strong reputation ({company.review_count} reviews)")
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Basic assessment"

    def _compute_urgency(self, company, website, audit):
        score = 20
        reasoning_parts = []
        if audit and audit.overall_score and audit.overall_score < 40:
            score += 30
            reasoning_parts.append(f"Low website score ({audit.overall_score}/100)")
        if website and website.last_crawled:
            days = (datetime.now(timezone.utc) - website.last_crawled.replace(tzinfo=timezone.utc)).days
            if days > 90:
                score += 15
                reasoning_parts.append("Website not updated recently")
        if not company.website:
            score += 20
            reasoning_parts.append("No website")
        if company.review_count and company.rating and company.rating < 3.5:
            score += 15
            reasoning_parts.append(f"Low rating ({company.rating})")
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Low urgency"

    def _compute_growth(self, company, website, tech_count):
        score = 30
        reasoning_parts = []
        if company.review_count and company.review_count > 50:
            score += 15
            reasoning_parts.append(f"Active customer base ({company.review_count} reviews)")
        if company.rating and company.rating >= 4.0:
            score += 10
            reasoning_parts.append(f"High rating ({company.rating})")
        if tech_count > 5:
            score += 10
            reasoning_parts.append(f"Multiple technologies ({tech_count})")
        if company.founded_year and (2024 - company.founded_year) < 3:
            score += 10
            reasoning_parts.append("Young company")
        if website and website.instagram:
            score += 5
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Moderate growth signals"

    def _compute_decision_maker(self, contacts, company):
        score = 10
        reasoning_parts = []
        if contacts:
            score += min(len(contacts) * 10, 30)
            reasoning_parts.append(f"{len(contacts)} contacts found")
            titles = [c.title or "" for c in contacts]
            if any("CEO" in t or "Founder" in t or "Owner" in t for t in titles):
                score += 25
                reasoning_parts.append("Decision maker identified")
            elif any("Director" in t or "Manager" in t for t in titles):
                score += 15
                reasoning_parts.append("Manager-level contact")
        if company.email:
            score += 10
            reasoning_parts.append("Direct email available")
        if company.phone:
            score += 5
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Limited contact info"

    def _compute_digital_maturity(self, company, website, audit, tech_count):
        score = 10
        reasoning_parts = []
        if audit:
            if audit.overall_score and audit.overall_score > 70:
                score += 15
                reasoning_parts.append(f"Good website ({audit.overall_score}/100)")
            elif audit.overall_score and audit.overall_score < 40:
                score += 25
                reasoning_parts.append(f"Poor website ({audit.overall_score}/100) - opportunity")
        if tech_count > 5:
            score += 10
        elif tech_count > 0:
            score += 5
        if website:
            if website.instagram: score += 5
            if website.facebook: score += 5
            if website.linkedin: score += 5
        if not company.website:
            score += 20
            reasoning_parts.append("No website - high opportunity")
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Low digital maturity"

    def _compute_sales_readiness(self, company, website, contacts):
        score = 20
        reasoning_parts = []
        if company.email:
            score += 15
            reasoning_parts.append("Email available")
        if company.phone:
            score += 10
            reasoning_parts.append("Phone available")
        if company.website:
            score += 10
        if contacts:
            primary = [c for c in contacts if c.is_primary]
            if primary:
                score += 15
                reasoning_parts.append("Primary contact identified")
        if company.website and any([
            website.instagram if website else False,
            website.facebook if website else False,
        ]):
            score += 10
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Limited sales signals"

    def _compute_ai_adoption(self, website, tech_count):
        score = 20
        reasoning_parts = []
        if tech_count > 10:
            score += 20
            reasoning_parts.append(f"Tech-forward ({tech_count} technologies)")
        elif tech_count > 5:
            score += 10
        if website:
            services = website.services or []
            ai_keywords = ["ai", "chatbot", "automation", "machine learning", "gpt"]
            for s in services:
                if isinstance(s, str) and any(kw in s.lower() for kw in ai_keywords):
                    score += 15
                    reasoning_parts.append("Uses AI services")
                    break
        return min(round(score, 1), 100), ". ".join(reasoning_parts) or "Low AI adoption"

    # ─── Recommendation Methods ───────────────────────────────────────

    def _recommend_action(self, overall, budget, urgency, digital):
        if overall >= 75:
            return "HIGH PRIORITY: Generate proposal and initiate outreach immediately"
        if overall >= 60:
            return "MEDIUM: Research further and prepare tailored proposal"
        if urgency >= 60:
            return "URGENCY: Contact immediately with quick-win pitch"
        if digital >= 60:
            return "OPPORTUNITY: Company has digital presence - pitch improvements"
        return "NURTURE: Add to nurture sequence, monitor for changes"

    def _recommend_outreach(self, contacts, company, overall):
        if overall >= 70 and contacts:
            primary = [c for c in contacts if c.email]
            if primary:
                return f"Email {primary[0].name} at {primary[0].email} with personalised audit report"
        if company.email:
            return f"Send introductory email to {company.email} with value proposition"
        if company.phone:
            return f"Call {company.phone} with a brief pitch"
        return "Research contact information before outreach"

    def _recommend_proposal_type(self, overall, digital, company):
        if overall >= 70:
            return "Full-service proposal with comprehensive audit, redesign, and SEO"
        if digital >= 60:
            return "Optimisation proposal focusing on performance and SEO improvements"
        if overall >= 40:
            return "Starter package with website audit and quick wins"
        return "Educational proposal showing digital transformation opportunities"

    def _recommend_pricing(self, opportunity, company, overall):
        if opportunity and opportunity.total_max:
            if opportunity.total_max > 50000:
                return "$25,000 - $75,000 (Enterprise)"
            if opportunity.total_max > 15000:
                return "$10,000 - $25,000 (Professional)"
            return "$3,000 - $10,000 (Starter)"
        if overall >= 70:
            return "$15,000 - $50,000 (High-value)"
        if overall >= 40:
            return "$5,000 - $15,000 (Mid-range)"
        return "$2,000 - $5,000 (Entry-level)"

    def _recommend_followup(self, overall, urgency, sales):
        if overall >= 70 and urgency >= 50:
            return "Follow up within 24-48 hours with a personalised proposal"
        if overall >= 50:
            return "Follow up within 1 week with an audit report and case studies"
        if urgency >= 60:
            return "Urgent: Follow up within 24 hours with a quick-win offer"
        return "Add to monthly newsletter and check for website changes"


client_readiness_service = ClientReadinessService()
