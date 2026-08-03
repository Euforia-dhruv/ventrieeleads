-- Intelligence Layer: Scores, Insights, Benchmarks, Reports
-- Applied: 2026-07-28

CREATE TABLE IF NOT EXISTS company_intelligence_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    growth_score DOUBLE PRECISION DEFAULT 0,
    digital_maturity_score DOUBLE PRECISION DEFAULT 0,
    marketing_maturity DOUBLE PRECISION DEFAULT 0,
    technology_maturity DOUBLE PRECISION DEFAULT 0,
    branding_maturity DOUBLE PRECISION DEFAULT 0,
    sales_readiness DOUBLE PRECISION DEFAULT 0,
    ai_readiness DOUBLE PRECISION DEFAULT 0,
    automation_readiness DOUBLE PRECISION DEFAULT 0,
    expansion_potential DOUBLE PRECISION DEFAULT 0,
    acquisition_probability DOUBLE PRECISION DEFAULT 0,
    computed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS discovery_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    score DOUBLE PRECISION DEFAULT 0,
    confidence DOUBLE PRECISION DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reasoning TEXT,
    action_data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS benchmark_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    country_code VARCHAR(10),
    avg_website_score DOUBLE PRECISION DEFAULT 0,
    avg_seo_score DOUBLE PRECISION DEFAULT 0,
    avg_design_score DOUBLE PRECISION DEFAULT 0,
    avg_performance_score DOUBLE PRECISION DEFAULT 0,
    avg_tech_age DOUBLE PRECISION DEFAULT 0,
    avg_review_count DOUBLE PRECISION DEFAULT 0,
    avg_rating DOUBLE PRECISION DEFAULT 0,
    avg_opportunity_score DOUBLE PRECISION DEFAULT 0,
    avg_project_value DOUBLE PRECISION DEFAULT 0,
    total_companies INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    total_audits INTEGER DEFAULT 0,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS executive_ai_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    top_opportunities JSONB DEFAULT '[]',
    top_cities JSONB DEFAULT '[]',
    top_industries JSONB DEFAULT '[]',
    top_campaigns JSONB DEFAULT '[]',
    top_providers JSONB DEFAULT '[]',
    system_health JSONB DEFAULT '{}',
    economics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ci_scores_company ON company_intelligence_scores(company_id);
CREATE INDEX IF NOT EXISTS idx_ci_scores_computed ON company_intelligence_scores(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_di_type_entity ON discovery_insights(insight_type, entity_type);
CREATE INDEX IF NOT EXISTS idx_di_priority ON discovery_insights(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_di_active ON discovery_insights(is_dismissed, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bs_type ON benchmark_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_bs_country ON benchmark_snapshots(country_code);
CREATE INDEX IF NOT EXISTS idx_bs_period ON benchmark_snapshots(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_eai_date ON executive_ai_reports(report_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eai_date_type ON executive_ai_reports(report_date, report_type);
