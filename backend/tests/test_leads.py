import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

pytest_plugins = ('tests.conftest',)

class TestLeadModel:
    async def test_create_lead(self, async_session):
        from src.database.models import Lead
        lead = Lead(
            company_name="Test Company",
            city="Dubai",
            country="AE",
            industry="IT Companies",
            status="New"
        )
        async_session.add(lead)
        await async_session.commit()
        assert lead.id is not None

    async def test_lead_status_values(self):
        from src.database.models import Lead
        valid_statuses = [
            'New', 'Qualified', 'Researching', 'Contacted',
            'Replied', 'Meeting', 'Proposal', 'Negotiation',
            'Won', 'Lost'
        ]
        for status in valid_statuses:
            lead = Lead(company_name=f"Test {status}", status=status)
            assert lead.status == status

class TestLeadQueries:
    async def test_get_leads(self, async_session):
        from src.database.queries import getLeads
        results = await getLeads(async_session)
        assert isinstance(results, list)

    async def test_create_lead_query(self, async_session):
        from src.database.queries import createLead
        lead_data = {
            "company_name": "Query Test",
            "city": "Dubai",
            "country": "AE"
        }
        result = await createLead(async_session, lead_data)
        assert result.company_name == "Query Test"

class TestAIIntegration:
    def test_ai_integration_exists(self):
        from src.ai.integrations import AIIntegration
        ai = AIIntegration()
        assert ai.settings.provider == 'ollama'

    def test_scout_agent_exists(self):
        from src.agents.scoutAgent import ScoutAgent
        agent = ScoutAgent()
        assert agent is not None

    def test_audit_agent_exists(self):
        from src.agents.auditAgent import AuditAgent
        agent = AuditAgent()
        assert agent is not None

class TestScoring:
    def test_score_color_classification(self):
        from src.lib.utils import getScoreColor
        assert getScoreColor(85) == 'text-green-500'
        assert getScoreColor(65) == 'text-yellow-500'
        assert getScoreColor(45) == 'text-orange-500'
        assert getScoreColor(25) == 'text-red-500'

    def test_status_colors(self):
        from src.lib.utils import statusColors
        assert 'bg-blue-500' in statusColors('New')
        assert 'bg-green-500' in statusColors('Won')
        assert 'bg-red-500' in statusColors('Lost')