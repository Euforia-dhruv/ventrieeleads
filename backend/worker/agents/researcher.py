import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class ResearcherAgent(BaseAgent):
    """Researches companies using AI to build comprehensive intelligence profiles."""
    
    name = 'researcher'
    description = 'AI-powered company research and intelligence'
    version = '1.0.0'
    
    def get_goals(self) -> List[str]:
        return [
            'Research every unprocessed company',
            'Read website metadata and content',
            'Summarize company business',
            'Identify services and pain points',
            'Estimate company size and budget',
            'Store reasoning for every decision',
        ]
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import Company, Website, Audit, Technology, CompanyResearch
        from worker.services.ai_client import ai_client
        
        session = SessionLocal()
        items_processed = 0
        items_created = 0
        items_updated = 0
        reasoning_parts = []
        
        try:
            config = context.get('config', {})
            max_per_run = config.get('max_per_run', 20)
            company_id = context.get('company_id')
            
            # Find companies that need research
            if company_id:
                companies = session.query(Company).filter(
                    Company.id == company_id,
                    Company.is_deleted == False,
                ).all()
            else:
                # Find companies without research
                researched_ids = session.query(CompanyResearch.company_id).filter(
                    CompanyResearch.is_deleted == False
                ).subquery()
                
                companies = session.query(Company).filter(
                    Company.is_deleted == False,
                    Company.id.notin_(researched_ids),
                ).order_by(Company.created_at.desc()).limit(max_per_run).all()
            
            reasoning_parts.append(f'Found {len(companies)} companies needing research')
            
            for company in companies:
                try:
                    # Skip if already researched recently
                    if self.has_already_done('researched', 'company', company.id, within_hours=72):
                        continue
                    
                    # Gather existing data
                    website = session.query(Website).filter(
                        Website.company_id == company.id,
                        Website.is_deleted == False,
                    ).first()
                    
                    audit = None
                    techs = []
                    if website:
                        audit = session.query(Audit).filter(
                            Audit.website_id == website.id,
                            Audit.is_deleted == False,
                        ).order_by(Audit.created_at.desc()).first()
                        
                        techs = session.query(Technology).filter(
                            Technology.company_id == company.id,
                            Technology.is_deleted == False,
                        ).all()
                    
                    # Build research prompt
                    company_data = {
                        'name': company.name,
                        'industry': company.industry or 'Unknown',
                        'city': company.city or 'Unknown',
                        'website': company.website or 'No website',
                        'description': company.description or '',
                        'phone': company.phone or '',
                        'email': company.email or '',
                        'rating': float(company.rating or 0),
                        'review_count': company.review_count or 0,
                    }
                    
                    if website:
                        company_data.update({
                            'title': website.title or '',
                            'meta_description': website.description or '',
                            'emails_found': website.emails or [],
                            'phone_numbers': website.phone_numbers or [],
                            'whatsapp': website.whatsapp or '',
                            'social_links': {
                                'instagram': website.instagram or '',
                                'facebook': website.facebook or '',
                                'linkedin': website.linkedin or '',
                            },
                            'services': website.services or [],
                            'about_content': (website.about_content or '')[:2000],
                        })
                    
                    if audit:
                        company_data['audit_scores'] = {
                            'overall': audit.overall_score,
                            'seo': audit.seo_score,
                            'performance': audit.performance_score,
                            'design': audit.design_score,
                            'conversion': audit.conversion_score,
                            'trust': audit.trust_score,
                            'weaknesses': audit.weaknesses or [],
                            'quick_wins': audit.quick_wins or [],
                        }
                    
                    if techs:
                        company_data['technology_stack'] = [
                            {'name': t.name, 'category': t.category} for t in techs
                        ]
                    
                    system_prompt = """You are an expert business intelligence analyst specializing in the UAE market. 
Analyze the company data and provide comprehensive research. 
Always respond with valid JSON matching this structure:
{
    "business_summary": "string - 2-3 sentence overview",
    "products": ["string"],
    "services": ["string"],
    "target_audience": "string",
    "business_type": "string (small_business/medium/enterprise/startup)",
    "unique_selling_points": ["string"],
    "growth_indicators": ["string"],
    "likely_pain_points": ["string"],
    "website_weaknesses": ["string"],
    "recommended_services": ["string"],
    "sales_talking_points": ["string"],
    "priority": "string (high/medium/low)",
    "estimated_budget": "string (e.g. $50,000-100,000)",
    "estimated_company_size": "string (e.g. 10-50 employees)"
}"""
                    
                    prompt = f"""Research this company comprehensively:

Company: {company_data['name']}
Industry: {company_data['industry']}
Location: {company_data['city']}
Website: {company_data['website']}
Rating: {company_data['rating']}/5 ({company_data['review_count']} reviews)
Description: {company_data['description']}

"""
                    if 'audit_scores' in company_data:
                        scores = company_data['audit_scores']
                        prompt += f"""Website Audit Scores:
- Overall: {scores['overall']}/100
- SEO: {scores['seo']}/100
- Performance: {scores['performance']}/100
- Design: {scores['design']}/100
- Conversion: {scores['conversion']}/100
- Trust: {scores['trust']}/100
- Weaknesses: {', '.join(scores.get('weaknesses', []))}
- Quick Wins: {', '.join(scores.get('quick_wins', []))}

"""
                    if 'technology_stack' in company_data:
                        tech_names = [t['name'] for t in company_data['technology_stack']]
                        prompt += f"Technology Stack: {', '.join(tech_names)}\n\n"
                    
                    if company_data.get('about_content'):
                        prompt += f"About Page Content:\n{company_data['about_content'][:1500]}\n\n"
                    
                    prompt += "Provide comprehensive research with actionable insights for a digital agency looking to sell services to this company."
                    
                    # Call AI
                    result = ai_client.generate_json_sync(prompt, system_prompt)
                    
                    if result.get('parse_error'):
                        reasoning_parts.append(f'{company.name}: AI response parse error')
                        continue
                    
                    # Save research
                    research = CompanyResearch(
                        company_id=company.id,
                        business_summary=result.get('business_summary', ''),
                        products=result.get('products', []),
                        services=result.get('services', []),
                        target_audience=result.get('target_audience', ''),
                        business_type=result.get('business_type', ''),
                        unique_selling_points=result.get('unique_selling_points', []),
                        growth_indicators=result.get('growth_indicators', []),
                        likely_pain_points=result.get('likely_pain_points', []),
                        website_weaknesses=result.get('website_weaknesses', []),
                        recommended_services=result.get('recommended_services', []),
                        sales_talking_points=result.get('sales_talking_points', []),
                        priority=result.get('priority', 'medium'),
                        estimated_budget=result.get('estimated_budget', ''),
                        estimated_company_size=result.get('estimated_company_size', ''),
                        confidence_score=0.7,
                        ai_model='ai_client',
                        raw_ai_response=result,
                    )
                    session.add(research)
                    
                    # Record in memory
                    self.remember(
                        'researched', f"Researched {company.name}: {result.get('business_summary', '')[:200]}",
                        entity_type='company', entity_id=company.id, confidence=0.7
                    )
                    
                    # Link knowledge graph
                    self.link_entities('company', company.id, 'research', research.id, 'has_research')
                    
                    items_created += 1
                    items_processed += 1
                    reasoning_parts.append(f'{company.name}: Researched ({result.get("priority", "medium")} priority)')
                    
                except Exception as e:
                    logger.error(f'Research failed for {company.name}: {e}')
                    reasoning_parts.append(f'{company.name}: Error - {str(e)[:100]}')
                    continue
            
            session.commit()
            
            # Publish event
            if items_created > 0:
                self.publish_event('research.completed', {
                    'count': items_created,
                }, target_agent='opportunity')
            
        finally:
            session.close()
        
        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': items_updated,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.7,
                'completeness': min(1.0, items_created / max(1, len(companies))) if companies else 0,
                'recency': 1.0,
                'source_reliability': 0.8,
            }),
        }


researcher_agent = ResearcherAgent()
