-- Discovery Orchestrator: Campaigns, Campaign Jobs, Provider Metrics
-- Applied: 2026-07-28

CREATE TABLE IF NOT EXISTS discovery_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',

    country_ids JSONB DEFAULT '[]',
    state_ids JSONB DEFAULT '[]',
    city_ids JSONB DEFAULT '[]',
    industry_ids JSONB DEFAULT '[]',
    provider_slugs JSONB DEFAULT '[]',

    priority INTEGER DEFAULT 5,
    max_businesses_per_city INTEGER DEFAULT 50,
    max_total_businesses INTEGER DEFAULT 10000,
    concurrency INTEGER DEFAULT 5,

    schedule_type VARCHAR(50) DEFAULT 'once',
    cron_expression VARCHAR(100),
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,

    total_jobs INTEGER DEFAULT 0,
    queued_jobs INTEGER DEFAULT 0,
    running_jobs INTEGER DEFAULT 0,
    completed_jobs INTEGER DEFAULT 0,
    failed_jobs INTEGER DEFAULT 0,
    skipped_jobs INTEGER DEFAULT 0,
    total_businesses INTEGER DEFAULT 0,
    unique_businesses INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,

    ai_requests INTEGER DEFAULT 0,
    provider_requests INTEGER DEFAULT 0,
    browser_sessions INTEGER DEFAULT 0,
    estimated_cost_usd DOUBLE PRECISION DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS campaign_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES discovery_campaigns(id) ON DELETE CASCADE,
    search_job_id UUID REFERENCES search_jobs(id),

    location_id UUID REFERENCES locations(id),
    industry_id UUID REFERENCES industries(id),
    provider_slug VARCHAR(100),

    country_code VARCHAR(10),
    state_name VARCHAR(255),
    city_name VARCHAR(255),
    industry_name VARCHAR(255),

    status VARCHAR(50) DEFAULT 'queued',
    businesses_found INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    new_businesses INTEGER DEFAULT 0,
    runtime_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    fallback_provider VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS provider_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_slug VARCHAR(100) NOT NULL,
    country_code VARCHAR(10) NOT NULL,

    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    avg_results_per_request DOUBLE PRECISION DEFAULT 0,
    duplicate_rate DOUBLE PRECISION DEFAULT 0,
    estimated_cost_per_request DOUBLE PRECISION DEFAULT 0,
    last_used_at TIMESTAMP,
    last_error TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,

    UNIQUE(provider_slug, country_code)
);

CREATE INDEX IF NOT EXISTS idx_dc_status ON discovery_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_dc_created ON discovery_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cj_campaign ON campaign_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cj_status ON campaign_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cj_search_job ON campaign_jobs(search_job_id);
CREATE INDEX IF NOT EXISTS idx_cj_location ON campaign_jobs(location_id);
CREATE INDEX IF NOT EXISTS idx_cj_industry ON campaign_jobs(industry_id);
CREATE INDEX IF NOT EXISTS idx_cj_provider ON campaign_jobs(provider_slug);
CREATE INDEX IF NOT EXISTS idx_cj_country ON campaign_jobs(country_code);
CREATE INDEX IF NOT EXISTS idx_pm_provider ON provider_metrics(provider_slug);
CREATE INDEX IF NOT EXISTS idx_pm_country ON provider_metrics(country_code);
CREATE INDEX IF NOT EXISTS idx_pm_lookup ON provider_metrics(provider_slug, country_code);
