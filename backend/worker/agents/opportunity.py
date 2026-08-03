import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class OpportunityAgent(BaseAgent):
    """Identifies businesses likely to buy based on multiple factors."""
    
    name = 'opportunity'
    description = 'Scores and prioritizes sales opportunities'
    version = '1.0.0'
    
    def get_goals(self) -> List[str]:
        return [
            'Score all companies for purchase likelihood',
            'Identify high-value opportunities',
            'Calculate opportunity confidence',
            'Generate urgency ratings',
        ]
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import (
            Company, Lead, Audit, CompanyResearch, Opportunity,
            Technology, MonitoringSnapshot, Website
        )
        
        session = SessionLocal()
        items_processed = 0
        items_created = 0
        items_updated = 0
        reasoning_parts = []
        
        try:
            config = context.get('config', {})
            max_per_run = config.get('max_per_run', 50)
            company_id = context.get('company_id')
            
            if company_id:
                companies = session.query(Company).filter(
                    Company.id == company_id,
                    Company.is_deleted == False,
                ).all()
            else:
                companies = session.query(Company).filter(
                    Company.is_deleted == False,
                ).order_by(Company.created_at.desc()).limit(max_per_run).all()
            
            reasoning_parts.append(f'Evaluating {len(companies)} companies for opportunities')
            
            for company in companies:
                try:
                    # Get related data
                    lead = session.query(Lead).filter(
                        Lead.company_id == company.id,
                        Lead.is_deleted == False,
                    ).first()
                    
                    if not lead:
                        continue
                    
                    # Check if opportunity already exists and was updated recently
                    existing = session.query(Opportunity).filter(
                        Opportunity.lead_id == lead.id,
                    ).first()
                    
                    if existing and self.has_already_done('scored', 'company', company.id, within_hours=24):
                        continue
                    
                    website = session.query(Website).filter(
                        Website.company_id == company.id,
                        Website.is_deleted == False,
                    ).first()
                    
                    audit = None
                    if website:
                        audit = session.query(Audit).filter(
                            Audit.website_id == website.id,
                            Audit.is_deleted == False,
                        ).order_by(Audit.created_at.desc()).first()
                    
                    research = session.query(CompanyResearch).filter(
                        CompanyResearch.company_id == company.id,
                        CompanyResearch.is_deleted == False,
                    ).order_by(CompanyResearch.created_at.desc()).first()
                    
                    techs = session.query(Technology).filter(
                        Technology.company_id == company.id,
                        Technology.is_deleted == False,
                    ).all()
                    
                    # Score the opportunity
                    scores = self._calculate_opportunity_score(
                        company, audit, research, techs, lead
                    )
                    
                    # Determine services and pricing
                    services, pricing = self._determine_services_and_pricing(
                        company, audit, research, techs
                    )
                    
                    # Calculate urgency
                    urgency = self._calculate_urgency(scores, company, audit)
                    
                    # Calculate confidence
                    confidence = self.calculate_confidence(scores['factors'])
                    
                    if existing:
                        # Update existing opportunity
                        for key, val in pricing.items():
                            setattr(existing, key, val)
                        existing.confidence = confidence
                        existing.urgency = urgency
                        existing.recommended_services = services
                        existing.priority = 'high' if confidence > 0.7 else 'medium' if confidence > 0.4 else 'low'
                        existing.updated_by_ai_at = __import__('datetime').datetime.utcnow()
                        items_updated += 1
                        opp = existing
                    else:
                        # Create new opportunity
                        opp = Opportunity(
                            lead_id=lead.id,
                            confidence=confidence,
                            urgency=urgency,
                            recommended_services=services,
                            priority='high' if confidence > 0.7 else 'medium' if confidence > 0.4 else 'low',
                            ai_notes=f'Score: {scores["total"]}/100. Factors: {", ".join(f"{k}={v:.2f}" for k, v in scores["factors"].items())}',
                            **pricing,
                        )
                        session.add(opp)
                        items_created += 1
                    
                    # Update lead score
                    lead.score = scores['total']
                    lead.score_label = 'hot' if scores['total'] >= 70 else 'warm' if scores['total'] >= 40 else 'cold'
                    
                    items_processed += 1
                    reasoning_parts.append(
                        f'{company.name}: Score {scores["total"]}/100, '
                        f'urgency={urgency}, confidence={confidence:.2f}'
                    )
                    
                except Exception as e:
                    logger.error(f'Opportunity scoring failed for {company.name}: {e}')
                    reasoning_parts.append(f'{company.name}: Error - {str(e)[:100]}')
                    continue
            
            session.commit()
            
            if items_created > 0:
                self.publish_event('opportunities.scored', {
                    'count': items_created + items_updated,
                }, target_agent='strategist')
            
        finally:
            session.close()
        
        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': items_updated,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.8,
                'completeness': min(1.0, items_processed / max(1, len(companies))) if companies else 0,
                'recency': 1.0,
                'consistency': 0.7,
            }),
        }
    
    def _calculate_opportunity_score(self, company, audit, research, techs, lead):
        """Multi-factor opportunity scoring."""
        factors = {}
        
        # Website quality factor (0-1): lower quality = higher opportunity
        if audit:
            quality = audit.overall_score or 50
            factors['website_need'] = max(0, 1.0 - quality / 100)
        else:
            factors['website_need'] = 0.8  # No audit = high need
        
        # Growth indicators from research
        if research:
            growth_count = len(research.growth_indicators or [])
            factors['growth'] = min(1.0, growth_count / 3)
            budget_str = research.estimated_budget or ''
            if 'high' in budget_str.lower() or '100k' in budget_str.lower():
                factors['budget'] = 0.9
            elif 'medium' in budget_str.lower() or '50k' in budget_str.lower():
                factors['budget'] = 0.6
            else:
                factors['budget'] = 0.4
        else:
            factors['growth'] = 0.3
            factors['budget'] = 0.4
        
        # Review activity (proxy for business activity)
        review_count = company.review_count or 0
        factors['activity'] = min(1.0, review_count / 100)
        
        # Technology age (outdated = opportunity)
        outdated_techs = ['wordpress', 'joomla', 'drupal', 'wix', 'squarespace']
        tech_names = [t.name.lower() for t in techs]
        outdated_count = sum(1 for t in tech_names if any(o in t for o in outdated_techs))
        factors['tech_age'] = min(1.0, outdated_count / 2) if tech_names else 0.5
        
        # Industry factor
        high_value_industries = [
            'real estate', 'construction', 'law', 'finance', 'healthcare',
            'hospitality', 'luxury', 'automotive', 'technology',
        ]
        industry = (company.industry or '').lower()
        factors['industry'] = 0.9 if any(h in industry for h in high_value_industries) else 0.5
        
        # Social presence (missing social = opportunity)
        has_website = bool(company.website)
        social_count = sum(1 for attr in ['twitter', 'tiktok', 'snapchat'] if getattr(company, attr, None))
        factors['social_gap'] = max(0, 0.8 - social_count * 0.2)
        
        # Weighted total
        weights = {
            'website_need': 0.25,
            'growth': 0.15,
            'budget': 0.20,
            'activity': 0.10,
            'tech_age': 0.10,
            'industry': 0.10,
            'social_gap': 0.10,
        }
        
        total = sum(factors.get(k, 0) * w for k, w in weights.items())
        total = max(0, min(100, int(total * 100)))
        
        return {'total': total, 'factors': factors}
    
    def _determine_services_and_pricing(self, company, audit, research, techs):
        """Determine what services to recommend and pricing."""
        services = []
        
        if audit:
            if audit.seo_score < 60:
                services.append('SEO Optimization')
            if audit.design_score < 60:
                services.append('Website Redesign')
            if audit.performance_score < 60:
                services.append('Performance Optimization')
            if audit.conversion_score < 60:
                services.append('Conversion Rate Optimization')
            if audit.trust_score < 60:
                services.append('Trust & Credibility')
        else:
            services.append('Website Development')
            services.append('SEO Optimization')
        
        if research:
            for svc in (research.recommended_services or []):
                if svc not in services:
                    services.append(svc)
        
        # Estimate pricing
        if not services:
            services = ['Website Maintenance']
        
        base_min = len(services) * 15000
        base_max = len(services) * 45000
        
        if any('redesign' in s.lower() for s in services):
            base_min += 35000
            base_max += 80000
        if any('seo' in s.lower() for s in services):
            base_min += 10000
            base_max += 25000
        
        pricing = {
            'total_min': base_min,
            'total_max': base_max,
        }
        
        # Distribute across categories
        per_service = len(services)
        if per_service > 0:
            pricing['website_redesign_min'] = base_min // per_service
            pricing['website_redesign_max'] = base_max // per_service
        
        return services, pricing
    
    def _calculate_urgency(self, scores, company, audit):
        """Calculate how urgently the company needs help."""
        total = scores['total']
        factors = scores['factors']
        
        if factors.get('website_need', 0) > 0.8:
            return 'critical'
        if total >= 70:
            return 'high'
        if total >= 50:
            return 'medium'
        return 'low'


opportunity_agent = OpportunityAgent()
