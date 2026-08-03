import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class ContentWriterAgent(BaseAgent):
    """Generates personalized proposals, emails, LinkedIn messages, and WhatsApp outreach."""

    name = 'content_writer'
    description = 'AI-powered personalized content generation'
    version = '1.0.0'

    def get_goals(self) -> List[str]:
        return [
            'Generate personalized proposals',
            'Write cold emails that convert',
            'Create LinkedIn outreach messages',
            'Draft WhatsApp messages',
            'Write follow-up sequences',
            'Never regenerate identical outputs',
        ]

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import (
            Company, Lead, Opportunity, CompanyResearch, Audit, Proposal
        )
        from worker.services.ai_client import ai_client

        session = SessionLocal()
        items_processed = 0
        items_created = 0
        reasoning_parts = []

        try:
            config = context.get('config', {})
            max_per_run = config.get('max_per_run', 10)
            content_type = context.get('content_type', 'proposal')
            company_id = context.get('company_id')

            # Find companies that need content
            if company_id:
                leads = session.query(Lead).filter(
                    Lead.company_id == company_id,
                    Lead.is_deleted == False,
                ).all()
            else:
                leads = session.query(Lead).filter(
                    Lead.is_deleted == False,
                    Lead.score >= 40,
                ).order_by(Lead.score.desc()).limit(max_per_run).all()

            reasoning_parts.append(f'Generating content for {len(leads)} leads')

            for lead in leads:
                try:
                    company = session.query(Company).filter(
                        Company.id == lead.company_id,
                        Company.is_deleted == False,
                    ).first()
                    if not company:
                        continue

                    # Skip if content already generated recently
                    if self.has_already_done(f'wrote_{content_type}', 'company', company.id, within_hours=72):
                        continue

                    research = session.query(CompanyResearch).filter(
                        CompanyResearch.company_id == company.id,
                        CompanyResearch.is_deleted == False,
                    ).order_by(CompanyResearch.created_at.desc()).first()

                    opp = session.query(Opportunity).filter(
                        Opportunity.lead_id == lead.id,
                    ).first()

                    # Build context for content generation
                    company_context = {
                        'name': company.name,
                        'industry': company.industry or 'business',
                        'city': company.city or 'Dubai',
                        'score': lead.score,
                    }
                    if research:
                        company_context['pain_points'] = research.likely_pain_points or []
                        company_context['talking_points'] = research.sales_talking_points or []
                        company_context['services'] = research.recommended_services or []
                        company_context['budget'] = research.estimated_budget or ''
                    if opp:
                        company_context['opp_services'] = opp.recommended_services or []
                        company_context['urgency'] = opp.urgency or 'medium'

                    system_prompt = f"""You are an expert copywriter for a digital agency.
Generate a personalized {content_type} for this prospect.
Be specific, reference their business, and focus on value.
Always respond with valid JSON:
{{
    "subject": "string (for email types)",
    "body": "string (the main content)",
    "personalization_hooks": ["string"],
    "call_to_action": "string"
}}"""

                    prompt = f"""Generate a {content_type} for:

Company: {company_context['name']}
Industry: {company_context['industry']}
City: {company_context['city']}
Lead Score: {company_context['score']}/100
"""
                    if company_context.get('pain_points'):
                        prompt += f"Pain Points: {', '.join(company_context['pain_points'][:3])}\n"
                    if company_context.get('talking_points'):
                        prompt += f"Talking Points: {', '.join(company_context['talking_points'][:3])}\n"
                    if company_context.get('opp_services'):
                        prompt += f"Services to Pitch: {', '.join(company_context['opp_services'][:3])}\n"
                    if company_context.get('budget'):
                        prompt += f"Budget Range: {company_context['budget']}\n"

                    prompt += f"\nMake it compelling, personalized, and action-oriented. Focus on how we can help {company_context['name']} specifically."

                    result = ai_client.generate_json_sync(prompt, system_prompt)

                    if result.get('parse_error'):
                        reasoning_parts.append(f'{company.name}: Content parse error')
                        continue

                    body = result.get('body', '')

                    # Store as proposal
                    proposal = Proposal(
                        company_id=company.id,
                        title=f"{content_type.title()} for {company.name}",
                        status='draft',
                        services=company_context.get('opp_services', []),
                        notes=body[:2000] if body else '',
                        generated_by_ai=True,
                        ai_model='ai_client',
                    )
                    session.add(proposal)

                    # Record in memory to avoid regeneration
                    self.remember(
                        f'wrote_{content_type}',
                        f"Generated {content_type} for {company.name}: {body[:200]}",
                        entity_type='company', entity_id=company.id,
                    )

                    self.link_entities('company', company.id, 'proposal', proposal.id, 'has_proposal')

                    items_created += 1
                    items_processed += 1
                    reasoning_parts.append(f'{company.name}: {content_type} generated ({len(body)} chars)')

                except Exception as e:
                    logger.error(f'Content generation failed: {e}')
                    reasoning_parts.append(f'Error: {str(e)[:100]}')
                    continue

            session.commit()

            if items_created > 0:
                self.publish_event('content.generated', {
                    'count': items_created,
                    'type': content_type,
                })

        finally:
            session.close()

        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': 0,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.7,
                'completeness': min(1.0, items_created / max(1, len(leads))) if leads else 0,
                'source_reliability': 0.8,
            }),
        }


content_writer_agent = ContentWriterAgent()
