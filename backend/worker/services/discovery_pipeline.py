"""Discovery Pipeline - unified multi-source lead discovery with scoring."""
import logging
import asyncio
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field

from worker.providers.base import NormalizedLead
from worker.providers.registry import registry

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Configuration for a discovery pipeline run."""
    query: str = ""
    industry: str = ""
    location: str = ""
    city: str = ""
    country: str = ""
    area: str = ""
    providers: List[str] = field(default_factory=list)
    max_results: int = 50
    min_rating: float = 0
    min_reviews: int = 0
    enable_scraping: bool = True
    enable_audit: bool = True
    enable_research: bool = True
    enable_scoring: bool = True
    dedup_strategy: str = "aggressive"  # none, basic, aggressive


@dataclass
class PipelineResult:
    """Result from a discovery pipeline run."""
    leads: List[NormalizedLead] = field(default_factory=list)
    total_discovered: int = 0
    after_dedup: int = 0
    after_scrape: int = 0
    after_audit: int = 0
    after_research: int = 0
    after_scoring: int = 0
    provider_stats: Dict[str, int] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    duration_ms: int = 0


class DiscoveryPipeline:
    """Unified discovery pipeline: search → dedup → scrape → audit → research → score."""

    async def run(self, config: PipelineConfig) -> PipelineResult:
        """Execute the full discovery pipeline."""
        start_time = datetime.utcnow()
        result = PipelineResult()

        try:
            # Step 1: Multi-source search
            leads = await self._search(config)
            result.total_discovered = len(leads)
            result.provider_stats = self._count_by_provider(leads)
            logger.info(f"Step 1 - Search: {len(leads)} leads from {len(result.provider_stats)} providers")

            # Step 2: Deduplicate
            leads = self._dedup(leads, config.dedup_strategy)
            result.after_dedup = len(leads)
            logger.info(f"Step 2 - Dedup: {len(leads)} unique leads")

            # Step 3: Scrape website details
            if config.enable_scraping:
                leads = await self._scrape_websites(leads)
                result.after_scrape = len(leads)
                logger.info(f"Step 3 - Scrape: {len(leads)} leads enriched")

            # Step 4: Audit contact data
            if config.enable_audit:
                leads = self._audit_contacts(leads)
                result.after_audit = len(leads)
                logger.info(f"Step 4 - Audit: {len(leads)} leads with valid contacts")

            # Step 5: Research additional details
            if config.enable_research:
                leads = await self._research(leads)
                result.after_research = len(leads)
                logger.info(f"Step 5 - Research: {len(leads)} leads enriched")

            # Step 6: Score leads
            if config.enable_scoring:
                leads = self._score_leads(leads)
                result.after_scoring = len(leads)
                logger.info(f"Step 6 - Score: {len(leads)} leads scored")

            result.leads = leads

        except Exception as e:
            result.errors.append(f"Pipeline error: {str(e)}")
            logger.error(f"Pipeline failed: {e}")

        result.duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return result

    async def _search(self, config: PipelineConfig) -> List[NormalizedLead]:
        """Multi-source search across configured providers."""
        query = config.query or f"{config.industry} in {config.city} {config.country}".strip()
        location = config.location or f"{config.area} {config.city} {config.country}".strip()

        providers = config.providers or registry.list_enabled_slugs()

        all_leads = []
        per_provider = config.max_results // max(len(providers), 1)

        for slug in providers:
            provider = registry.get(slug)
            if not provider or not provider.is_ready or not provider.is_enabled:
                continue

            try:
                leads = await provider.search(
                    query=query,
                    location=location,
                    max_results=per_provider,
                    min_rating=config.min_rating,
                    min_reviews=config.min_reviews,
                )
                all_leads.extend(leads)
                logger.debug(f"Provider {slug}: {len(leads)} results")
            except Exception as e:
                logger.error(f"Provider {slug} failed: {e}")

        return all_leads

    def _dedup(self, leads: List[NormalizedLead], strategy: str) -> List[NormalizedLead]:
        """Deduplicate leads using specified strategy."""
        if strategy == "none":
            return leads

        seen = {}
        deduped = []

        for lead in leads:
            key = self._dedup_key(lead, strategy)

            if key in seen:
                # Merge data from duplicate
                existing = seen[key]
                self._merge_lead(existing, lead)
            else:
                seen[key] = lead
                deduped.append(lead)

        return deduped

    def _dedup_key(self, lead: NormalizedLead, strategy: str) -> str:
        """Generate dedup key based on strategy."""
        name = lead.name.lower().strip()
        website = lead.website.lower().strip() if lead.website else ""

        if strategy == "aggressive":
            # Match on name + website
            import re
            clean_name = re.sub(r'[^\w\s]', '', name)
            return f"{clean_name}|{website}"
        else:
            # Basic: match on name only
            return name

    def _merge_lead(self, target: NormalizedLead, source: NormalizedLead) -> None:
        """Merge data from source into target, keeping non-empty values."""
        if not target.website and source.website:
            target.website = source.website
        if not target.phone and source.phone:
            target.phone = source.phone
        if not target.email and source.email:
            target.email = source.email
        if not target.address and source.address:
            target.address = source.address
        if not target.description and source.description:
            target.description = source.description
        if not target.logo_url and source.logo_url:
            target.logo_url = source.logo_url
        if source.rating > target.rating:
            target.rating = source.rating
        if source.review_count > target.review_count:
            target.review_count = source.review_count
        if not target.social_links:
            target.social_links = source.social_links

    async def _scrape_websites(self, leads: List[NormalizedLead]) -> List[NormalizedLead]:
        """Scrape website details for leads without contact info."""
        from worker.browser.manager import get_browser_manager

        manager = await get_browser_manager()
        enriched = []

        for lead in leads:
            if not lead.website:
                enriched.append(lead)
                continue

            try:
                result = await manager.fetch(lead.website, timeout=15)
                if result.success:
                    # Extract emails and phones from HTML
                    import re
                    from bs4 import BeautifulSoup

                    soup = BeautifulSoup(result.html, "html.parser")
                    text = soup.get_text(separator=" ", strip=True)

                    # Extract emails
                    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
                    excluded = ['example.com', 'email.com', 'test.com', 'sentry.io']
                    valid_emails = [e.lower() for e in emails if not any(ex in e.lower() for ex in excluded)]

                    if not lead.email and valid_emails:
                        lead.email = valid_emails[0]

                    # Extract phones
                    phones = re.findall(r'(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
                    valid_phones = [p for p in phones if len(re.sub(r'[^\d]', '', p)) >= 8]

                    if not lead.phone and valid_phones:
                        lead.phone = valid_phones[0]

                    # Extract social links
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if "linkedin.com/company" in href:
                            lead.social_links["linkedin"] = href
                        elif "facebook.com" in href:
                            lead.social_links["facebook"] = href
                        elif "instagram.com" in href:
                            lead.social_links["instagram"] = href

            except Exception as e:
                logger.debug(f"Scrape failed for {lead.website}: {e}")

            enriched.append(lead)

        return enriched

    def _audit_contacts(self, leads: List[NormalizedLead]) -> List[NormalizedLead]:
        """Audit lead contact data quality."""
        audited = []

        for lead in leads:
            score = 0
            if lead.name:
                score += 1
            if lead.website:
                score += 1
            if lead.phone:
                score += 1
            if lead.email:
                score += 1
            if lead.address:
                score += 1

            lead.metadata["contact_score"] = score
            lead.metadata["has_valid_contact"] = score >= 2

            if score >= 2:
                audited.append(lead)

        return audited

    async def _research(self, leads: List[NormalizedLead]) -> List[NormalizedLead]:
        """Research additional details for high-value leads."""
        for lead in leads:
            if lead.metadata.get("contact_score", 0) < 3:
                continue

            # Add industry classification if missing
            if not lead.industry:
                lead.industry = self._guess_industry(lead)

            # Add social links if missing
            if not lead.social_links.get("linkedin") and lead.name:
                lead.metadata["needs_linkedin_search"] = True

        return leads

    def _score_leads(self, leads: List[NormalizedLead]) -> List[NormalizedLead]:
        """Score leads based on completeness and quality."""
        for lead in leads:
            score = 0

            # Contact completeness (0-40)
            if lead.phone:
                score += 15
            if lead.email:
                score += 15
            if lead.website:
                score += 5
            if lead.address:
                score += 5

            # Quality signals (0-30)
            if lead.rating >= 4.0:
                score += 10
            elif lead.rating >= 3.0:
                score += 5
            if lead.review_count >= 50:
                score += 10
            elif lead.review_count >= 10:
                score += 5
            if lead.description:
                score += 5

            # Social presence (0-20)
            social_count = len(lead.social_links)
            score += min(social_count * 5, 20)

            # Industry match (0-10)
            if lead.industry:
                score += 10

            lead.metadata["lead_score"] = min(score, 100)
            lead.metadata["lead_grade"] = self._grade_lead(score)

        # Sort by score
        leads.sort(key=lambda l: l.metadata.get("lead_score", 0), reverse=True)

        return leads

    def _guess_industry(self, lead: NormalizedLead) -> str:
        """Simple industry guess from name/description."""
        text = f"{lead.name} {lead.description}".lower()
        industry_keywords = {
            "restaurant": "Food & Beverage",
            "cafe": "Food & Beverage",
            "hotel": "Hospitality",
            "clinic": "Healthcare",
            "hospital": "Healthcare",
            "school": "Education",
            "university": "Education",
            "gym": "Fitness",
            "salon": "Beauty",
            "construction": "Construction",
            "real estate": "Real Estate",
            "marketing": "Marketing",
            "software": "Technology",
            "design": "Design",
        }
        for keyword, industry in industry_keywords.items():
            if keyword in text:
                return industry
        return ""

    def _grade_lead(self, score: int) -> str:
        """Convert numeric score to letter grade."""
        if score >= 80:
            return "A"
        elif score >= 60:
            return "B"
        elif score >= 40:
            return "C"
        elif score >= 20:
            return "D"
        return "F"

    def _count_by_provider(self, leads: List[NormalizedLead]) -> Dict[str, int]:
        """Count leads by provider source."""
        counts = {}
        for lead in leads:
            source = lead.source or "unknown"
            counts[source] = counts.get(source, 0) + 1
        return counts


# Global instance
discovery_pipeline = DiscoveryPipeline()
