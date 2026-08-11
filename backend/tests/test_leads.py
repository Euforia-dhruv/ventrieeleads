import pytest
from worker.agents.base import BaseAgent, AgentEvent
from worker.agents.scout import ScoutAgent


class TestAgentEvent:
    def test_event_initializes(self):
        event = AgentEvent("companies.discovered", "scout", {"count": 5})
        assert event.event_type == "companies.discovered"
        assert event.source_agent == "scout"
        assert event.status == "pending"
        assert event.id

    def test_event_to_dict(self):
        event = AgentEvent("test.event", "agent", {"k": "v"}, target_agent="other")
        data = event.to_dict()
        assert data["event_type"] == "test.event"
        assert data["target_agent"] == "other"
        assert data["payload"] == {"k": "v"}
        assert "created_at" in data


class TestBaseAgent:
    class ConcreteAgent(BaseAgent):
        def execute(self, context):
            return {"items_processed": 0, "items_created": 0}

        def get_goals(self):
            return ["goal"]

    def test_calculate_confidence_bounds(self):
        agent = self.ConcreteAgent()
        assert 0.0 <= agent.calculate_confidence({"data_quality": 1.0}) <= 1.0

    def test_calculate_confidence_empty(self):
        agent = self.ConcreteAgent()
        assert agent.calculate_confidence({}) == 0.0

    def test_calculate_confidence_clamps(self):
        agent = self.ConcreteAgent()
        assert agent.calculate_confidence({"data_quality": 5.0}) <= 1.0
        assert agent.calculate_confidence({"data_quality": -1.0}) >= 0.0

    def test_calculate_confidence_high_factors(self):
        agent = self.ConcreteAgent()
        confidence = agent.calculate_confidence(
            {"data_quality": 1.0, "completeness": 1.0, "recency": 1.0, "consistency": 1.0, "sample_size": 1.0}
        )
        assert confidence == 1.0

    def test_name_default(self):
        assert BaseAgent.name == "base"
        assert BaseAgent.version == "1.0.0"


class TestScoutAgent:
    def test_agent_initializes(self):
        agent = ScoutAgent()
        assert agent.name == "scout"
        assert agent.description == "Discovers new businesses from directory providers"

    def test_goals(self):
        agent = ScoutAgent()
        goals = agent.get_goals()
        assert len(goals) >= 3
        assert any("Discover" in g for g in goals)

    def test_instance_exported(self):
        from worker.agents.scout import scout_agent
        assert scout_agent.name == "scout"


class TestLeadScoringServiceIntegration:
    def test_scoring_service_instantiable(self):
        from worker.services.scoring import lead_scorer
        assert lead_scorer is not None

    def test_scoring_service_exports_labels(self):
        from worker.services.scoring import LeadScoringService
        result = LeadScoringService().score(website_score=10)
        assert result["label"] in ("hot", "warm", "cold")
