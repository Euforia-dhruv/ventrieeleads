import pytest
from worker.services.audit import AuditService
from worker.services.scoring import LeadScoringService


@pytest.fixture
def audit_service():
    return AuditService()


@pytest.fixture
def lead_scorer():
    return LeadScoringService()


class TestAuditService:
    def test_seo_score_max(self, audit_service):
        checks = {
            "has_title": True,
            "has_meta_description": True,
            "has_h1": True,
            "has_viewport": True,
            "has_schema": True,
            "has_opengraph": True,
            "has_canonical": True,
            "has_robots": True,
            "has_sitemap": True,
            "has_alt_text": True,
            "ssl": True,
        }
        assert audit_service._calc_seo(checks) == 100

    def test_seo_score_missing_elements(self, audit_service):
        assert audit_service._calc_seo({}) < 40

    def test_perf_score_slow_site(self, audit_service):
        assert audit_service._calc_perf(6.0, {"ssl": True}) < 70
        assert audit_service._calc_perf(0.5, {"ssl": True}) == 100

    def test_conversion_score_with_cta(self, audit_service):
        checks = {"has_cta": True, "has_whatsapp": True, "has_booking": True, "has_analytics": True, "has_meta_pixel": True}
        assert audit_service._calc_conv(checks) == 100

    def test_budget_estimation(self, audit_service):
        assert audit_service._estimate_budget(20) == "$15,000 - $30,000"
        assert audit_service._estimate_budget(40) == "$30,000 - $50,000"
        assert audit_service._estimate_budget(60) == "$50,000 - $75,000"
        assert audit_service._estimate_budget(80) == "$75,000 - $100,000"
        assert audit_service._estimate_budget(95) == "$100,000 - $150,000+"

    def test_issues_generation(self, audit_service):
        issues = audit_service._get_issues({"ssl": False, "has_cta": False}, 4.0)
        titles = [i["title"] for i in issues]
        assert "No SSL" in titles
        assert "Slow Loading" in titles
        assert "No Clear CTAs" in titles

    def test_recommended_services_for_bad_website(self, audit_service):
        result = {
            "seo_score": 30,
            "performance_score": 40,
            "design_score": 50,
            "conversion_score": 30,
            "branding_score": 40,
            "copywriting_score": 50,
            "trust_score": 50,
        }
        services = audit_service._recommend_services(result)
        assert "SEO Optimization" in services
        assert "Conversion Rate Optimization" in services

    def test_website_score_composition(self, audit_service):
        checks = {
            "ssl": True,
            "has_title": True,
            "has_meta_description": True,
            "has_h1": True,
            "has_viewport": True,
            "has_schema": True,
            "has_opengraph": True,
            "has_canonical": True,
            "has_robots": True,
            "has_sitemap": True,
            "has_alt_text": True,
        }
        seo = audit_service._calc_seo(checks)
        perf = audit_service._calc_perf(0.5, checks)
        design = audit_service._calc_design(checks)
        access = audit_service._calc_access(checks)
        brand = audit_service._calc_brand(checks, "about our story who we are mission vision values")
        score = round(seo * 0.3 + perf * 0.25 + design * 0.2 + access * 0.15 + brand * 0.1)
        assert 0 <= score <= 100


class TestLeadScoring:
    def test_score_range(self, lead_scorer):
        result = lead_scorer.score()
        assert 0 <= result["score"] <= 100

    def test_hot_lead(self, lead_scorer):
        result = lead_scorer.score(
            website_score=90,
            review_count=150,
            rating=4.8,
            has_website=True,
            has_email=True,
            has_phone=True,
            has_whatsapp=True,
            tech_count=8,
            social_count=5,
            industry="Real Estate",
        )
        assert result["label"] == "hot"
        assert result["score"] >= 70

    def test_cold_lead(self, lead_scorer):
        result = lead_scorer.score(
            website_score=10,
            review_count=0,
            rating=0,
            has_website=False,
            has_email=False,
            has_phone=False,
            tech_count=0,
            social_count=0,
            industry="",
        )
        assert result["label"] == "cold"
        assert result["score"] < 40

    def test_high_value_industry_bonus(self, lead_scorer):
        high = lead_scorer.score(website_score=50, industry="Real Estate")
        low = lead_scorer.score(website_score=50, industry="Some Unknown Industry")
        assert high["score"] >= low["score"]

    def test_opportunity_score_high_for_bad_site(self, lead_scorer):
        opp = lead_scorer._calculate_opportunity_score(
            website_score=10,
            review_count=0,
            rating=0,
            has_website=False,
            has_email=False,
            has_phone=False,
            has_whatsapp=False,
            tech_count=0,
            social_count=0,
            industry="Real Estate",
            issues=["issue1", "issue2", "issue3"],
        )
        assert opp > 50


class TestDnsSslProfile:
    def test_profile_additive_on_failure(self, audit_service):
        profile = audit_service._dns_ssl_profile("not-a-real-host.invalid")
        assert isinstance(profile, dict)
        assert "ssl_valid" not in profile or profile.get("ssl_error")
        assert "resolved_ips" in profile or "dns_error" in profile

    def test_profile_populates_fields_for_known_host(self, audit_service):
        profile = audit_service._dns_ssl_profile("https://example.com")
        assert profile.get("resolved_ips")
        assert profile.get("ssl_valid") is True
        assert profile.get("tls_version")
        assert "ssl_days_left" in profile
