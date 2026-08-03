"""Intelligent search and executive insights tasks."""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='worker.tasks.intelligence.intelligent_search', bind=True,
             soft_time_limit=120, time_limit=300)
def intelligent_search(self, query: str, workspace_id: str = None):
    """Natural language search translated into structured filters."""
    from worker.services.ai_client import ai_client
    from worker.models.database import SessionLocal
    from worker.models import Company, Lead

    session = SessionLocal()

    try:
        system_prompt = """You are a search query parser for a lead generation platform.
Convert natural language queries into structured search filters.
Always respond with valid JSON:
{
    "industry": "string or null",
    "city": "string or null",
    "area": "string or null",
    "min_score": number or null,
    "max_score": number or null,
    "min_rating": number or null,
    "has_website": boolean or null,
    "has_whatsapp": boolean or null,
    "technology": "string or null",
    "keywords": ["string"],
    "intent": "string describing what the user is looking for"
}"""

        result = ai_client.generate_json_sync(
            f"Parse this search query: '{query}'",
            system_prompt
        )

        if result.get('parse_error'):
            return {'success': False, 'error': 'Could not understand query'}

        from sqlalchemy import and_

        q = session.query(Company).filter(Company.is_deleted == False)

        if result.get('industry'):
            q = q.filter(Company.industry.ilike(f'%{result["industry"]}%'))
        if result.get('city'):
            q = q.filter(Company.city.ilike(f'%{result["city"]}%'))
        if result.get('area'):
            q = q.filter(Company.area.ilike(f'%{result["area"]}%'))
        if result.get('keywords'):
            for kw in result['keywords']:
                q = q.filter(
                    (Company.name.ilike(f'%{kw}%')) |
                    (Company.description.ilike(f'%{kw}%')) |
                    (Company.industry.ilike(f'%{kw}%'))
                )

        companies = q.limit(50).all()

        if result.get('min_score') or result.get('max_score'):
            lead_q = session.query(Lead.company_id).filter(Lead.is_deleted == False)
            if result.get('min_score'):
                lead_q = lead_q.filter(Lead.score >= result['min_score'])
            if result.get('max_score'):
                lead_q = lead_q.filter(Lead.score <= result['max_score'])
            lead_ids = [r[0] for r in lead_q.all()]
            companies = [c for c in companies if c.id in lead_ids]

        return {
            'success': True,
            'data': {
                'query': query,
                'parsed_filters': result,
                'intent': result.get('intent', ''),
                'results': [{
                    'id': str(c.id),
                    'name': c.name,
                    'industry': c.industry,
                    'city': c.city,
                    'website': c.website,
                    'rating': float(c.rating or 0),
                    'review_count': c.review_count or 0,
                } for c in companies[:50]],
                'total': len(companies),
            }
        }

    finally:
        session.close()


@shared_task(name='worker.tasks.intelligence.self_improvement', bind=True,
             soft_time_limit=120, time_limit=300)
def analyze_quality_metrics(self):
    """Analyze quality metrics and recommend improvements."""
    from worker.models.database import SessionLocal
    from worker.models import QualityMetric, AgentExecution, AgentState

    session = SessionLocal()

    try:
        from datetime import datetime, timedelta

        since = datetime.utcnow() - timedelta(hours=24)

        agents = session.query(AgentState).all()
        agent_stats = []
        for agent in agents:
            if agent.total_runs > 0:
                agent_stats.append({
                    'name': agent.agent_name,
                    'success_rate': (agent.successful_runs / agent.total_runs * 100) if agent.total_runs else 0,
                    'avg_duration_ms': agent.avg_duration_ms,
                    'total_runs': agent.total_runs,
                    'confidence': agent.confidence,
                })

        metrics = session.query(QualityMetric).filter(
            QualityMetric.created_at > since
        ).all()

        metric_summary = {}
        for m in metrics:
            if m.metric_name not in metric_summary:
                metric_summary[m.metric_name] = []
            metric_summary[m.metric_name].append(m.metric_value)

        return {
            'success': True,
            'data': {
                'agent_performance': agent_stats,
                'quality_trends': {
                    k: {
                        'avg': sum(v) / len(v),
                        'min': min(v),
                        'max': max(v),
                        'count': len(v),
                    }
                    for k, v in metric_summary.items()
                },
            }
        }

    finally:
        session.close()
