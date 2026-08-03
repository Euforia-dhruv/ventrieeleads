"""Celery tasks for autonomous agents."""
import logging
from celery import shared_task
from worker.agents import get_agent, AGENTS

logger = logging.getLogger(__name__)


@shared_task(name='worker.tasks.agents.run_agent', bind=True, max_retries=2,
             soft_time_limit=300, time_limit=600)
def run_agent(self, agent_name: str, context: dict = None):
    """Run a single agent by name."""
    agent = get_agent(agent_name)
    if not agent:
        return {'success': False, 'error': f'Unknown agent: {agent_name}'}

    context = context or {}
    result = agent.run(context)
    return result


@shared_task(name='worker.tasks.agents.run_all_agents', bind=True,
             soft_time_limit=600, time_limit=900)
def run_all_agents(self, context: dict = None):
    """Run all enabled agents in sequence (Manager coordinates)."""
    context = context or {}
    results = {}

    manager = get_agent('manager')
    if manager:
        results['manager'] = manager.run({**context, 'action': 'coordinate'})

    agent_order = ['scout', 'researcher', 'auditor', 'opportunity', 'strategist', 'content_writer', 'monitor']

    for name in agent_order:
        agent = get_agent(name)
        if agent:
            try:
                results[name] = agent.run(context)
            except Exception as e:
                logger.error(f'Agent {name} failed: {e}')
                results[name] = {'success': False, 'error': str(e)}

    return {
        'success': all(r.get('success', False) for r in results.values()),
        'agents_run': len(results),
        'results': {k: {'success': v.get('success'), 'items': v.get('items_processed', 0)} for k, v in results.items()},
    }


@shared_task(name='worker.tasks.agents.generate_briefing', bind=True,
             soft_time_limit=300, time_limit=600)
def generate_briefing(self):
    """Generate daily executive briefing."""
    manager = get_agent('manager')
    if manager:
        return manager.run({'action': 'briefing'})
    return {'success': False, 'error': 'Manager not available'}


@shared_task(name='worker.tasks.agents.health_check', bind=True,
             soft_time_limit=60, time_limit=120)
def health_check(self):
    """Run health check on all agents."""
    manager = get_agent('manager')
    if manager:
        return manager.run({'action': 'health_check'})
    return {'success': False, 'error': 'Manager not available'}


@shared_task(name='worker.tasks.agents.recover_failures', bind=True,
             soft_time_limit=120, time_limit=300)
def recover_failures(self):
    """Recover failed agent executions."""
    manager = get_agent('manager')
    if manager:
        return manager.run({'action': 'recover'})
    return {'success': False, 'error': 'Manager not available'}


@shared_task(name='worker.tasks.agents.run_single_agent', bind=True, max_retries=2,
             soft_time_limit=300, time_limit=600)
def run_single_agent(self, agent_name: str, company_id: str = None):
    """Run a single agent on a specific company."""
    agent = get_agent(agent_name)
    if not agent:
        return {'success': False, 'error': f'Unknown agent: {agent_name}'}

    context = {}
    if company_id:
        context['company_id'] = company_id

    return agent.run(context)
