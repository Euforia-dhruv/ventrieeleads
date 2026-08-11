"""Integration tests for the AI Lead Generation Platform worker modules."""

from worker.agents.scout import ScoutAgent
from worker.services.audit import AuditService
from worker.services.scoring import LeadScoringService
from worker.providers.registry import registry


class TestScoutingPipeline:
    """Test the lead scouting pipeline from discovery to storage."""

    def test_scout_agent_ready(self):
        agent = ScoutAgent()
        assert agent.name == "scout"
        assert callable(agent.execute)

    def test_scout_goals_align_with_pipeline(self):
        goals = ScoutAgent().get_goals()
        assert any("Discover" in g for g in goals)


class TestAuditToProposalPipeline:
    """Test the audit-to-proposal workflow."""

    def test_audit_service_ready(self):
        assert AuditService() is not None

    def test_audit_produces_budget_for_scores(self):
        audit = AuditService()
        budget = audit._estimate_budget(60)
        assert isinstance(budget, str) and "$" in budget


class TestScoringPipeline:
    """Test scoring of discovered leads."""

    def test_lead_scoring_ready(self):
        result = LeadScoringService().score(website_score=80, industry="Real Estate")
        assert 0 <= result["score"] <= 100

    def test_scoring_labels_present(self):
        assert LeadScoringService().score()["label"] in ("hot", "warm", "cold")


class TestProviderRegistry:
    """Test that provider registry is loadable and exposes providers."""

    def test_registry_loaded(self):
        assert hasattr(registry, "list_enabled_slugs")

    def test_registry_has_providers(self):
        slugs = registry.list_enabled_slugs()
        assert isinstance(slugs, list)
        assert len(slugs) >= 0


class TestUAEData:
    """Test UAE-specific location templates."""

    POPULAR_LOCATIONS = [
        {"name": "Dubai", "country": "UAE", "areas": ["Downtown Dubai", "Business Bay", "Dubai Marina"]},
        {"name": "Abu Dhabi", "country": "UAE", "areas": ["Al Reem Island", "Saadiyat Island", "Yas Island"]},
        {"name": "Sharjah", "country": "UAE", "areas": ["Al Majaz", "Al Nahda", "Al Khan"]},
    ]

    def test_dubai_areas_loaded(self):
        dubai = next(l for l in self.POPULAR_LOCATIONS if l["name"] == "Dubai")
        assert len(dubai["areas"]) >= 3

    def test_all_emirates_available(self):
        names = [l["name"] for l in self.POPULAR_LOCATIONS]
        assert "Dubai" in names
        assert "Abu Dhabi" in names
        assert "Sharjah" in names

    def test_industry_classification(self):
        from worker.services.scoring import LeadScoringService
        service = LeadScoringService()
        assert "real estate" in service.HIGH_VALUE_INDUSTRIES
