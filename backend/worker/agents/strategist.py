import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class StrategistAgent(BaseAgent):
    """Determines sales strategy: what to sell, pricing, talking points, objections."""

    name = 'strategist'
    description = 'AI sales strategy and playbook generation'
    version = '1.0.0'

    def get_goals(self) -> List[str]:
        return [
            'Determine what service to sell to each company',
            'Suggest pricing ranges based on company profile',
            'Identify pain points and talking points',
            'Prepare objection responses',
            'Generate meeting strategies',
        ]

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import (
            Company, Lead, Opportunity, CompanyResearch, Audit, Website
        )
        from worker.services.ai_client import ai_client

        session = SessionLocal()
        items_processed = 0
        items_created = 0
        reasoning_parts = []

        try:
            config = context.get('config', {})
            max_per_run = config.get('max_per_run', 20)
            company_id = context.get('company_id')

            # Find companies with opportunities that need strategy
            if company_id:
                opportunities = session.query(Opportunity).join(Lead).filter(
                    Lead.company_id == company_id,
                    Lead.is_deleted == False,
                ).all()
            else:
                opportunities = session.query(Opportunity).join(Lead).filter(
                    Lead.is_deleted == False,
                    Opportunity.confidence > 0.3,
                ).order_by(Opportunity.confidence.desc()).limit(max_per_run).all()

            reasoning_parts.append(f'Building strategy for {len(opportunities)} opportunities')

            for opp in opportunities:
                try:
                    lead = session.query(Lead).filter(Lead.id == opp.lead_id).first()
                    if not lead:
                        continue

                    company = session.query(Company).filter(
                        Company.id == lead.company_id,
                        Company.is_deleted == False,
                    ).first()
                    if not company:
                        continue

                    # Skip if strategy already generated recently
                    if self.has_already_done('strategized', 'company', company.id, within_hours=72):
                        continue

                    research = session.query(CompanyResearch).filter(
                        CompanyResearch.company_id == company.id,
                        CompanyResearch.is_deleted == False,
                    ).order_by(CompanyResearch.created_at.desc()).first()

                    audit = None
                    website = session.query(Website).filter(
                        Website.company_id == company.id,
                        Website.is_deleted == False,
                    ).first()
                    if website:
                        audit = session.query(Audit).filter(
                            Audit.website_id == website.id,
                            Audit.is_deleted == False,
                        ).order_by(Audit.created_at.desc()).first()

                    # Build strategy prompt
                    context_data = {
                        'company': company.name,
                        'industry': company.industry,
                        'city': company.city,
                        'website': company.website,
                        'score': lead.score,
                        'opportunity_score': float(opp.confidence) * 100,
                        'services': opp.recommended_services or [],
                    }
                    if research:
                        context_data['pain_points'] = research.likely_pain_points or []
                        context_data['talking_points'] = research.sales_talking_points or []
                        context_data['budget'] = research.estimated_budget or 'Unknown'
                        context_data['company_size'] = research.estimated_company_size or 'Unknown'
                    if audit:
                        context_data['weaknesses'] = audit.weaknesses or []
                        context_data['scores'] = {
                            'overall': audit.overall_score,
                            'seo': audit.seo_score,
                            'design': audit.design_score,
                        }

                    system_prompt = """You are an expert sales strategist for a digital agency.
Analyze the company and generate a comprehensive sales strategy.
Always respond with valid JSON:
{
    "strategy_summary": "string",
    "recommended_approach": "string (cold_call/email/meeting/referral)",
    "talking_points": ["string"],
    "pain_points_to_address": ["string"],
    "objections_and_responses": [{"objection": "string", "response": "string"}],
    "meeting_strategy": "string",
    "pricing_strategy": "string",
    "close_probability": number (0-100),
    "next_best_action": "string",
    "personalization_hooks": ["string"]
}"""

                    prompt = f"""Generate a sales strategy for this company:

Company: {context_data['company']}
Industry: {context_data.get('industry', 'Unknown')}
City: {context_data.get('city', 'Unknown')}
Website: {context_data.get('website', 'None')}
Lead Score: {context_data['score']}/100
Opportunity Confidence: {context_data['opportunity_score']:.0f}%
Recommended Services: {', '.join(context_data['services'])}

"""
                    if 'scores' in context_data:
                        scores = context_data['scores']
                        prompt += f"Website Scores: Overall={scores.get('overall', 0)}, SEO={scores.get('seo', 0)}, Design={scores.get('design', 0)}\n"
                    if 'pain_points' in context_data:
                        prompt += f"Known Pain Points: {', '.join(context_data['pain_points'])}\n"
                    if 'budget' in context_data:
                        prompt += f"Estimated Budget: {context_data['budget']}\n"
                    if 'company_size' in context_data:
                        prompt += f"Company Size: {context_data['company_size']}\n"

                    prompt += "\nGenerate a comprehensive, actionable sales strategy."

                    result = ai_client.generate_json_sync(prompt, system_prompt)

                    if result.get('parse_error'):
                        reasoning_parts.append(f'{company.name}: Strategy parse error')
                        continue

                    # Store strategy in opportunity notes and ai_notes
                    strategy_text = (
                        f"Strategy: {result.get('strategy_summary', '')}\n"
                        f"Approach: {result.get('recommended_approach', '')}\n"
                        f"Next Action: {result.get('next_best_action', '')}\n"
                        f"Close Probability: {result.get('close_probability', 50)}%"
                    )

                    opp.notes = strategy_text
                    opp.confidence = max(float(opp.confidence), result.get('close_probability', 50) / 100)

                    # Store as memory
                    self.remember(
                        'strategy',
                        f"Strategy for {company.name}: {result.get('strategy_summary', '')[:200]}",
                        entity_type='company', entity_id=company.id,
                        confidence=float(opp.confidence),
                    )

                    # Link knowledge graph
                    self.link_entities('company', company.id, 'strategy', opp.id, 'has_strategy')

                    items_created += 1
                    items_processed += 1
                    reasoning_parts.append(
                        f'{company.name}: {result.get("recommended_approach", "N/A")} '
                        f'(close prob: {result.get("close_probability", 0)}%)'
                    )

                except Exception as e:
                    logger.error(f'Strategy failed for opportunity: {e}')
                    reasoning_parts.append(f'Error: {str(e)[:100]}')
                    continue

            session.commit()

            if items_created > 0:
                self.publish_event('strategies.completed', {'count': items_created}, target_agent='content_writer')

        finally:
            session.close()

        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': 0,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.7,
                'completeness': min(1.0, items_processed / max(1, len(opportunities))) if opportunities else 0,
                'source_reliability': 0.7,
            }),
        }


strategist_agent = StrategistAgent()
