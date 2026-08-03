from worker.agents.base import BaseAgent
from worker.agents.scout import ScoutAgent, scout_agent
from worker.agents.researcher import ResearcherAgent, researcher_agent
from worker.agents.auditor import AuditorAgent, auditor_agent
from worker.agents.opportunity import OpportunityAgent, opportunity_agent
from worker.agents.strategist import StrategistAgent, strategist_agent
from worker.agents.content_writer import ContentWriterAgent, content_writer_agent
from worker.agents.monitor import MonitorAgent, monitor_agent
from worker.agents.manager import ManagerAgent, manager_agent

__all__ = [
    'BaseAgent',
    'ScoutAgent', 'scout_agent',
    'ResearcherAgent', 'researcher_agent',
    'AuditorAgent', 'auditor_agent',
    'OpportunityAgent', 'opportunity_agent',
    'StrategistAgent', 'strategist_agent',
    'ContentWriterAgent', 'content_writer_agent',
    'MonitorAgent', 'monitor_agent',
    'ManagerAgent', 'manager_agent',
]

AGENTS = {
    'scout': scout_agent,
    'researcher': researcher_agent,
    'auditor': auditor_agent,
    'opportunity': opportunity_agent,
    'strategist': strategist_agent,
    'content_writer': content_writer_agent,
    'monitor': monitor_agent,
    'manager': manager_agent,
}

def get_agent(name: str) -> BaseAgent:
    return AGENTS.get(name)

def list_agents() -> list:
    return [{'name': a.name, 'description': a.description, 'version': a.version} for a in AGENTS.values()]
