-- ============================================================
-- PHASE 3 MIGRATION - Ventriee Leads
-- ============================================================

-- ============================================================
-- MODULE 15: PLUGIN SYSTEM - Provider configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    provider_type VARCHAR(50) NOT NULL DEFAULT 'scraper',
    config JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    last_run_at TIMESTAMP,
    total_results INTEGER DEFAULT 0,
    success_rate FLOAT DEFAULT 0.0,
    avg_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

INSERT INTO provider_configs (name, slug, description, provider_type, config, is_enabled, priority)
VALUES
    ('Google Maps', 'google_maps', 'Google Maps business discovery via Playwright', 'scraper', '{"requires_browser": true}', true, 1),
    ('Clutch.co', 'clutch', 'Clutch.co agency directory', 'scraper', '{"base_url": "https://clutch.co"}', true, 2),
    ('GoodFirms', 'goodfirms', 'GoodFirms agency directory', 'scraper', '{"base_url": "https://www.goodfirms.co"}', true, 3),
    ('DesignRush', 'designrush', 'DesignRush agency directory', 'scraper', '{"base_url": "https://www.designrush.com"}', true, 4),
    ('PeoplePerHour', 'peopleperhour', 'PeoplePerHour freelancer marketplace', 'scraper', '{"base_url": "https://www.peopleperhour.com"}', false, 5),
    ('Contra', 'contra', 'Contra independent professionals', 'scraper', '{"base_url": "https://contra.com"}', false, 6),
    ('Yello UAE', 'yello_uae', 'Yello UAE business directory', 'scraper', '{"base_url": "https://www.yello.ae"}', true, 7),
    ('Dubai Directory', 'dubai_directory', 'Dubai business directory', 'scraper', '{"base_url": "https://www.dubaiphonebook.com"}', true, 8)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- MODULE 2: AI RESEARCH - Company intelligence
-- ============================================================
CREATE TABLE IF NOT EXISTS company_research (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    business_summary TEXT,
    products JSONB DEFAULT '[]',
    services JSONB DEFAULT '[]',
    target_audience TEXT,
    business_type VARCHAR(100),
    unique_selling_points JSONB DEFAULT '[]',
    growth_indicators JSONB DEFAULT '[]',
    likely_pain_points JSONB DEFAULT '[]',
    website_weaknesses JSONB DEFAULT '[]',
    recommended_services JSONB DEFAULT '[]',
    sales_talking_points JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium',
    estimated_budget VARCHAR(100),
    estimated_company_size VARCHAR(100),
    confidence_score FLOAT DEFAULT 0.0,
    ai_model VARCHAR(100),
    raw_ai_response JSONB DEFAULT '{}',
    researched_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_company_research_company ON company_research(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_research_company ON company_research(company_id) WHERE is_deleted = false;

-- ============================================================
-- MODULE 3: COMPETITOR ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    competitor_ids JSONB DEFAULT '[]',
    comparison_data JSONB DEFAULT '{}',
    strengths JSONB DEFAULT '[]',
    weaknesses JSONB DEFAULT '[]',
    competitive_advantages JSONB DEFAULT '[]',
    suggested_improvements JSONB DEFAULT '[]',
    overall竞争优势 VARCHAR(50),
    confidence_score FLOAT DEFAULT 0.0,
    ai_model VARCHAR(100),
    raw_ai_response JSONB DEFAULT '{}',
    analyzed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_competitor_analyses_company ON competitor_analyses(company_id);

-- ============================================================
-- MODULE 4: WEBSITE REDESIGN PREVIEW
-- ============================================================
CREATE TABLE IF NOT EXISTS redesign_previews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    homepage_wireframe TEXT,
    hero_concept TEXT,
    color_palette JSONB DEFAULT '[]',
    typography JSONB DEFAULT '[]',
    layout_suggestions JSONB DEFAULT '[]',
    modern_ui_recommendations JSONB DEFAULT '[]',
    cta_improvements JSONB DEFAULT '[]',
    booking_improvements JSONB DEFAULT '[]',
    trust_section_improvements JSONB DEFAULT '[]',
    before_after_summary TEXT,
    pdf_path TEXT,
    ai_model VARCHAR(100),
    raw_ai_response JSONB DEFAULT '{}',
    generated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_redesign_previews_company ON redesign_previews(company_id);

-- ============================================================
-- MODULE 5: PROPOSAL GENERATOR
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    executive_summary TEXT,
    current_problems JSONB DEFAULT '[]',
    recommended_solution TEXT,
    scope JSONB DEFAULT '[]',
    timeline VARCHAR(100),
    deliverables JSONB DEFAULT '[]',
    investment_min INTEGER DEFAULT 0,
    investment_max INTEGER DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'AED',
    expected_roi TEXT,
    maintenance_plan TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    pdf_path TEXT,
    markdown_path TEXT,
    docx_path TEXT,
    ai_model VARCHAR(100),
    raw_ai_response JSONB DEFAULT '{}',
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS ix_proposals_company ON proposals(company_id);
CREATE INDEX IF NOT EXISTS ix_proposals_status ON proposals(status);

-- ============================================================
-- MODULE 8: LIVE WEBSITE MONITORING
-- ============================================================
CREATE TABLE IF NOT EXISTS monitoring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    check_interval_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    last_check_at TIMESTAMP,
    next_check_at TIMESTAMP,
    checks_enabled JSONB DEFAULT '["scores", "technologies", "reviews", "ssl", "uptime"]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_monitoring_schedules_company ON monitoring_schedules(company_id);
CREATE INDEX IF NOT EXISTS ix_monitoring_schedules_next ON monitoring_schedules(next_check_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS monitoring_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES monitoring_schedules(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    overall_score INTEGER,
    seo_score INTEGER,
    performance_score INTEGER,
    technology_stack JSONB DEFAULT '[]',
    review_count INTEGER,
    rating FLOAT,
    ssl_valid BOOLEAN,
    uptime_status VARCHAR(20),
    changes_detected JSONB DEFAULT '[]',
    snapshot_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_monitoring_snapshots_schedule ON monitoring_snapshots(schedule_id);
CREATE INDEX IF NOT EXISTS ix_monitoring_snapshots_company ON monitoring_snapshots(company_id);

-- ============================================================
-- MODULE 11: REPORT BUILDER
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    report_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    title VARCHAR(500) NOT NULL,
    config JSONB DEFAULT '{}',
    file_path TEXT,
    file_format VARCHAR(20) DEFAULT 'pdf',
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_reports_workspace ON reports(workspace_id);
CREATE INDEX IF NOT EXISTS ix_reports_type ON reports(report_type);

-- ============================================================
-- MODULE 14: SEARCH ANALYTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_job_id UUID REFERENCES search_jobs(id),
    provider VARCHAR(100),
    query VARCHAR(500),
    city VARCHAR(100),
    industry VARCHAR(100),
    duration_ms INTEGER,
    businesses_found INTEGER DEFAULT 0,
    websites_analysed INTEGER DEFAULT 0,
    avg_score FLOAT DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_search_analytics_job ON search_analytics(search_job_id);
CREATE INDEX IF NOT EXISTS ix_search_analytics_provider ON search_analytics(provider);
CREATE INDEX IF NOT EXISTS ix_search_analytics_created ON search_analytics(created_at);

-- ============================================================
-- MODULE 10: WORKSPACE ENHANCEMENTS
-- ============================================================
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS max_searches INTEGER DEFAULT 100;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- ============================================================
-- MODULE 7: OPPORTUNITY ENGINE ENHANCEMENTS
-- ============================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS estimated_timeline VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS ai_notes TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS updated_by_ai_at TIMESTAMP;

-- ============================================================
-- MODULE 1: PROVIDER TRACKING ON COMPANIES
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provider_slug VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provider_raw_data JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS ix_companies_provider ON companies(provider_slug);

-- ============================================================
-- MODULE 2: RESEARCH TRACKING ON LEADS
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS research_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS competitor_analysis_id UUID;

-- ============================================================
-- MODULE 8: MONITORING ON COMPANIES
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_monitored_at TIMESTAMP;

-- ============================================================
-- DEFAULT PROVIDER CONFIGS SEED (if not already present)
-- ============================================================
INSERT INTO admin_settings (key, value, description, category)
VALUES
    ('ai_research_enabled', 'true', 'Enable AI research for new companies', 'ai'),
    ('ai_research_model', '"auto"', 'AI model for research (auto uses configured provider)', 'ai'),
    ('competitor_analysis_enabled', 'true', 'Enable competitor analysis', 'ai'),
    ('redesign_preview_enabled', 'true', 'Enable redesign preview generation', 'ai'),
    ('proposal_auto_generate', 'false', 'Auto-generate proposals for hot leads', 'ai'),
    ('monitoring_default_interval', '24', 'Default monitoring check interval in hours', 'monitoring'),
    ('report_storage_path', '"/app/data/reports"', 'Path for generated reports', 'reports'),
    ('max_concurrent_research', '2', 'Max concurrent AI research tasks', 'performance')
ON CONFLICT (key) DO NOTHING;
