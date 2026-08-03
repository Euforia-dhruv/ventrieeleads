import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class ManagerAgent(BaseAgent):
    """Coordinates all agents, prevents duplicate work, schedules tasks, recovers failures."""

    name = 'manager'
    description = 'Master coordinator for all autonomous agents'
    version = '1.0.0'

    def get_goals(self) -> List[str]:
        return [
            'Coordinate all agent execution',
            'Prevent duplicate work across agents',
            'Schedule agent runs optimally',
            'Prioritize queues based on business value',
            'Track execution and recover failures',
            'Generate executive briefings',
        ]

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import (
            AgentState, AgentExecution, AgentEvent, Company, Lead,
            Opportunity, Notification, ExecutiveBriefing
        )
        from worker.services.ai_client import ai_client

        session = SessionLocal()
        items_processed = 0
        items_created = 0
        reasoning_parts = []

        try:
            action = context.get('action', 'coordinate')

            if action == 'coordinate':
                result = self._coordinate_agents(session, context)
                reasoning_parts.append(result['reasoning'])
                items_processed = result['items_processed']
                items_created = result['items_created']

            elif action == 'briefing':
                result = self._generate_briefing(session, context)
                reasoning_parts.append(result['reasoning'])
                items_created = result.get('items_created', 0)

            elif action == 'health_check':
                result = self._health_check(session)
                reasoning_parts.append(result['reasoning'])
                items_processed = result.get('items_processed', 0)

            elif action == 'recover':
                result = self._recover_failures(session)
                reasoning_parts.append(result['reasoning'])
                items_processed = result.get('items_processed', 0)

            else:
                result = self._coordinate_agents(session, context)
                reasoning_parts.append(result['reasoning'])
                items_processed = result['items_processed']
                items_created = result['items_created']

                events = session.query(AgentEvent).filter(
                    AgentEvent.status == 'pending'
                ).order_by(AgentEvent.created_at.asc()).limit(50).all()

                if events:
                    reasoning_parts.append(f'Processing {len(events)} pending events')
                    for event in events:
                        self._route_event(event, session)
                        event.status = 'processed'
                        event.processed_at = __import__('datetime').datetime.utcnow()
                        items_processed += 1

            session.commit()

        finally:
            session.close()

        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': 0,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': 0.9,
        }

    def _coordinate_agents(self, session, context):
        """Check all agent states and schedule work."""
        from worker.models import AgentState

        agents = session.query(AgentState).filter(
            AgentState.is_enabled == True
        ).all()

        idle_agents = [a for a in agents if a.status in ('idle', 'error')]
        running_agents = [a for a in agents if a.status == 'running']

        reasoning = f'Agents: {len(agents)} total, {len(idle_agents)} idle, {len(running_agents)} running'

        from datetime import datetime, timedelta
        stuck_threshold = datetime.utcnow() - timedelta(minutes=10)
        stuck = [a for a in running_agents if a.last_run_at and a.last_run_at < stuck_threshold]
        if stuck:
            for agent in stuck:
                agent.status = 'idle'
                reasoning += f'; Unstuck {agent.agent_name}'

        return {'reasoning': reasoning, 'items_processed': len(agents), 'items_created': 0}

    def _generate_briefing(self, session, context):
        """Generate daily executive briefing."""
        from datetime import datetime, date
        from worker.models import (
            Company, Lead, Opportunity, MonitoringSnapshot, CompanyResearch
        )
        from worker.services.ai_client import ai_client

        today = date.today()

        existing = session.query(ExecutiveBriefing).filter(
            ExecutiveBriefing.briefing_date == today,
            ExecutiveBriefing.briefing_type == 'morning',
        ).first()

        if existing:
            return {'reasoning': 'Briefing already exists for today', 'items_created': 0}

        top_opps = session.query(Opportunity).join(Lead).filter(
            Lead.is_deleted == False,
        ).order_by(Opportunity.confidence.desc()).limit(20).all()

        opp_data = []
        for opp in top_opps:
            lead = session.query(Lead).filter(Lead.id == opp.lead_id).first()
            if lead:
                company = session.query(Company).filter(
                    Company.id == lead.company_id,
                    Company.is_deleted == False,
                ).first()
                if company:
                    opp_data.append({
                        'company': company.name,
                        'industry': company.industry or 'Unknown',
                        'city': company.city or 'Unknown',
                        'score': lead.score,
                        'confidence': float(opp.confidence) * 100,
                        'urgency': opp.urgency or 'medium',
                        'services': opp.recommended_services or [],
                    })

        recent_snapshots = session.query(MonitoringSnapshot).filter(
            MonitoringSnapshot.created_at > datetime.utcnow() - __import__('datetime').timedelta(hours=24),
        ).all()

        changes = []
        for snap in recent_snapshots:
            if snap.changes_detected:
                company = session.query(Company).filter(Company.id == snap.company_id).first()
                if company:
                    changes.append({
                        'company': company.name,
                        'changes': snap.changes_detected,
                    })

        from sqlalchemy import func
        industry_stats = session.query(
            Company.industry, func.count(Company.id)
        ).filter(
            Company.is_deleted == False,
            Company.industry.isnot(None),
        ).group_by(Company.industry).order_by(func.count(Company.id).desc()).limit(10).all()

        city_stats = session.query(
            Company.city, func.count(Company.id)
        ).filter(
            Company.is_deleted == False,
            Company.city.isnot(None),
        ).group_by(Company.city).order_by(func.count(Company.id).desc()).limit(10).all()

        system_prompt = "You are an executive analyst. Generate a concise morning briefing summary."
        prompt = f"""Generate a morning briefing for a digital agency:

Top Opportunities ({len(opp_data)}):
"""
        for opp in opp_data[:5]:
            prompt += f"- {opp['company']} ({opp['industry']}, {opp['city']}): Score {opp['score']}, Confidence {opp['confidence']:.0f}%, Urgency: {opp['urgency']}\n"

        prompt += f"\nWebsite Changes ({len(changes)}): "
        for c in changes[:5]:
            prompt += f"\n- {c['company']}: {len(c['changes'])} changes"

        prompt += f"\n\nIndustries: {', '.join(f'{i[0]}({i[1]})' for i in industry_stats[:5])}"
        prompt += f"\nCities: {', '.join(f'{c[0]}({c[1]})' for c in city_stats[:5])}"

        prompt += "\n\nProvide a 3-paragraph executive summary with key insights and recommended actions."

        ai_result = ai_client.generate(prompt, system_prompt)

        briefing = ExecutiveBriefing(
            briefing_date=today,
            briefing_type='morning',
            top_opportunities=opp_data,
            website_changes=changes,
            highest_value_prospects=[o for o in opp_data if o['score'] >= 70][:10],
            growing_industries=[{'industry': i[0], 'count': i[1]} for i in industry_stats],
            active_cities=[{'city': c[0], 'count': c[1]} for c in city_stats],
            recommended_actions=[],
            summary=ai_result if isinstance(ai_result, str) else str(ai_result),
        )
        session.add(briefing)

        return {
            'reasoning': f'Briefing generated: {len(opp_data)} opportunities, {len(changes)} changes',
            'items_created': 1,
        }

    def _health_check(self, session):
        """Check health of all agents and system components."""
        from worker.models import AgentState

        agents = session.query(AgentState).all()
        healthy = sum(1 for a in agents if a.status in ('idle', 'running'))
        total = len(agents)

        for agent in agents:
            if agent.total_runs > 5:
                failure_rate = agent.failed_runs / agent.total_runs
                if failure_rate > 0.5:
                    agent.is_enabled = False
                    logger.warning(f'Disabled {agent.agent_name}: {failure_rate:.0%} failure rate')

        return {
            'reasoning': f'Health check: {healthy}/{total} agents healthy',
            'items_processed': total,
            'items_created': 0,
        }

    def _recover_failures(self, session):
        """Retry failed agent executions."""
        from worker.models import AgentExecution

        failed = session.query(AgentExecution).filter(
            AgentExecution.status == 'failed',
            AgentExecution.retry_count < 3,
        ).order_by(AgentExecution.created_at.desc()).limit(10).all()

        recovered = 0
        for execution in failed:
            execution.retry_count += 1
            execution.status = 'retrying'
            recovered += 1

        return {
            'reasoning': f'Marked {recovered} failed executions for retry',
            'items_processed': recovered,
            'items_created': 0,
        }

    def _route_event(self, event, session):
        """Route an event to the appropriate agent."""
        event_type = event.event_type
        payload = event.payload or {}

        routing = {
            'companies.discovered': 'researcher',
            'research.completed': 'opportunity',
            'audits.completed': 'opportunity',
            'opportunities.scored': 'strategist',
            'strategies.completed': 'content_writer',
            'company.changed': 'researcher',
            'content.generated': None,
        }

        target = routing.get(event_type)
        if target:
            event.target_agent = target
            logger.info(f'Event {event_type} routed to {target}')


manager_agent = ManagerAgent()
