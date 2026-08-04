"""Lead scoring algorithm with AI enhancement."""
import logging
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
