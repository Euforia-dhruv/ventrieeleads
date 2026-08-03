"""Lead scoring algorithm."""
import logging
from typing import Dict

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
        industry: str = ""
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

        logger.info(f"Lead score: {score} ({label})")
        return {"score": score, "label": label}


lead_scorer = LeadScoringService()
