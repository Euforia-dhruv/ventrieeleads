"""Lead scoring algorithm with AI enhancement."""
import asyncio
import logging
import json
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class LeadScoringService:
    """Score leads based on multiple factors (0-100 scale)."""

    HIGH_VALUE_INDUSTRIES = frozenset([
        "real estate", "construction", "law firm", "accounting",
        "luxury brands", "hotels", "medical clinics", "it companies",
        "marketing agencies", "interior designers", "architects",
        "dentists", "clinics", "car rentals", "gyms", "restaurants"
    ])

    def score(
        self,
        website_score: int = 0,
        review_count: int = 0,
        rating: float = 0,
        has_website: bool = True,
        has_email: bool = False,
        has_phone: bool = False,
        has_whatsapp: bool = False,
        tech_count: int = 0,
        social_count: int = 0,
        industry: str = "",
        audit_issues: list = None,
        description: str = "",
    ) -> Dict:
        """Calculate lead score 0-100."""
        score = 0.0

        # Website quality (35 points max)
        score += min(35, website_score * 0.35)

        # Reviews & rating (25 points max)
        if review_count > 100:
            score += 12
        elif review_count > 50:
            score += 10
        elif review_count > 20:
            score += 7
        elif review_count > 5:
            score += 4
        elif review_count > 0:
            score += 2

        if rating >= 4.5:
            score += 13
        elif rating >= 4.0:
            score += 10
        elif rating >= 3.5:
            score += 7
        elif rating >= 3.0:
            score += 4
        elif rating > 0:
            score += 2

        # Contact availability (15 points max)
        if has_website: score += 3
        if has_email: score += 4
        if has_phone: score += 4
        if has_whatsapp: score += 4

        # Technology & social presence (15 points max)
        if tech_count > 5:
            score += 8
        elif tech_count > 2:
            score += 5
        elif tech_count > 0:
            score += 2

        if social_count > 3:
            score += 7
        elif social_count > 1:
            score += 4
        elif social_count > 0:
            score += 2

        # Industry bonus (10 points max)
        industry_lower = industry.lower().strip()
        if industry_lower in self.HIGH_VALUE_INDUSTRIES:
            score += 10
        elif industry:
            score += 5

        score = max(0, min(100, round(score)))

        if score >= 70:
            label = "hot"
        elif score >= 40:
            label = "warm"
        else:
            label = "cold"

        # Calculate sub-scores for reporting
        website_quality = min(100, website_score)
        contact_score = sum([has_website, has_email, has_phone, has_whatsapp]) * 25
        tech_presence = min(100, (tech_count * 15) + (social_count * 10))
        reputation = min(100, (min(review_count / 100, 1) * 50) + (min(rating / 5, 1) * 50))
        opportunity_score = self._calculate_opportunity_score(
            website_score, review_count, rating, has_website, has_email,
            has_phone, has_whatsapp, tech_count, social_count, industry,
            audit_issues or []
        )

        logger.info(f"Lead score: {score} ({label})")
        return {
            "score": score,
            "label": label,
            "website_quality": round(website_quality),
            "contact_score": round(contact_score),
            "tech_presence": round(tech_presence),
            "reputation": round(reputation),
            "opportunity_score": round(opportunity_score),
        }

    async def ai_score(
        self,
        company_name: str = "",
        industry: str = "",
        website: str = "",
        website_score: int = 0,
        review_count: int = 0,
        rating: float = 0,
        has_website: bool = True,
        has_email: bool = False,
        has_phone: bool = False,
        has_whatsapp: bool = False,
        tech_count: int = 0,
        social_count: int = 0,
        audit_issues: list = None,
        audit_strengths: list = None,
        audit_weaknesses: list = None,
        tech_names: list = None,
        city: str = "",
        country: str = "",
    ) -> Dict:
        """AI-enhanced scoring. Falls back to heuristic if AI unavailable."""
        try:
            from worker.services.ai_client import ai_client

            issues_text = ", ".join((audit_issues or [])[:5]) or "none identified"
            strengths_text = ", ".join((audit_strengths or [])[:3]) or "none identified"
            weaknesses_text = ", ".join((audit_weaknesses or [])[:5]) or "none identified"
            techs_text = ", ".join((tech_names or [])[:10]) or "none detected"

            prompt = f"""Analyze this business for a web development agency lead score.

Company: {company_name}
Industry: {industry}
Location: {city}, {country}
Website: {website}
Google Rating: {rating}/5 ({review_count} reviews)
Has Website: {has_website}
Has Email: {has_email}
Has Phone: {has_phone}
Has WhatsApp: {has_whatsapp}
Website Score: {website_score}/100
Technologies: {techs_text}
Social Links: {social_count} detected

Audit Issues: {issues_text}
Audit Strengths: {strengths_text}
Audit Weaknesses: {weaknesses_text}

Return as JSON:
{{
  "lead_score": 0-100,
  "opportunity_score": 0-100,
  "website_score": 0-100,
  "urgency": "high|medium|low",
  "buying_probability": 0-100,
  "estimated_project_value": "$X,XXX - $XX,XXX",
  "recommended_service": "specific service name",
  "pain_points": ["list of specific problems"],
  "reasons": ["list of reasons to contact"],
  "outreach_angle": "one sentence pitch angle"
}}"""

            result = await ai_client.generate_json(prompt)
            if result and isinstance(result, dict) and "lead_score" in result:
                return {
                    "score": max(0, min(100, int(result.get("lead_score", 50)))),
                    "label": self._score_label(int(result.get("lead_score", 50))),
                    "opportunity_score": max(0, min(100, int(result.get("opportunity_score", 50)))),
                    "website_quality": max(0, min(100, int(result.get("website_score", website_score)))),
                    "urgency": result.get("urgency", "medium"),
                    "buying_probability": max(0, min(100, int(result.get("buying_probability", 50)))),
                    "estimated_project_value": result.get("estimated_project_value", ""),
                    "recommended_service": result.get("recommended_service", ""),
                    "pain_points": result.get("pain_points", []),
                    "reasons": result.get("reasons", []),
                    "outreach_angle": result.get("outreach_angle", ""),
                    "ai_enhanced": True,
                }

        except Exception as e:
            logger.warning(f"AI scoring failed, falling back to heuristic: {e}")

        # Fallback to heuristic
        result = self.score(
            website_score=website_score,
            review_count=review_count,
            rating=rating,
            has_website=has_website,
            has_email=has_email,
            has_phone=has_phone,
            has_whatsapp=has_whatsapp,
            tech_count=tech_count,
            social_count=social_count,
            industry=industry,
            audit_issues=audit_issues,
        )
        result["ai_enhanced"] = False
        result["pain_points"] = audit_weaknesses or []
        result["reasons"] = audit_strengths or []
        result["outreach_angle"] = f"Improve {company_name}'s digital presence"
        return result

    def _score_label(self, score: int) -> str:
        if score >= 70:
            return "hot"
        elif score >= 40:
            return "warm"
        return "cold"

    def _calculate_opportunity_score(
        self,
        website_score: int,
        review_count: int,
        rating: float,
        has_website: bool,
        has_email: bool,
        has_phone: bool,
        has_whatsapp: bool,
        tech_count: int,
        social_count: int,
        industry: str,
        issues: list,
    ) -> float:
        """Calculate opportunity score - how much work they need (higher = more opportunity)."""
        opp = 0.0

        # Bad website = big opportunity
        if website_score < 30:
            opp += 30
        elif website_score < 50:
            opp += 20
        elif website_score < 70:
            opp += 10

        # Missing basics = opportunity
        if not has_website:
            opp += 20
        if not has_email:
            opp += 10
        if not has_phone:
            opp += 5
        if not has_whatsapp:
            opp += 5

        # Low tech = opportunity
        if tech_count == 0:
            opp += 15
        elif tech_count < 3:
            opp += 8

        # Many issues = opportunity
        opp += min(len(issues) * 3, 20)

        # High-value industry with bad presence = high opportunity
        industry_lower = industry.lower().strip()
        if industry_lower in self.HIGH_VALUE_INDUSTRIES and website_score < 50:
            opp += 15

        return min(100, opp)


lead_scorer = LeadScoringService()
