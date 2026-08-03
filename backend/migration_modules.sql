-- Module 1: AI Sales Pipeline
-- Module 4: Client Readiness Score
-- Module 5: AI Negotiation Assistant
-- Module 6: Learning Engine V2
-- Module 7: Global Business Graph (expansion)
-- Module 8: Intelligent Automation
-- Module 9: Autonomous Improvement
-- Module 11: Observability

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 1: AI SALES PIPELINE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT '#6B7280',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    auto_transition_rules JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lead_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    assigned_agent VARCHAR(100),
    confidence DOUBLE PRECISION DEFAULT 0.5,
    estimated_value_min INTEGER DEFAULT 0,
    estimated_value_max INTEGER DEFAULT 0,
    probability DOUBLE PRECISION DEFAULT 0,
    entered_at TIMESTAMP DEFAULT NOW(),
    exited_at TIMESTAMP,
    total_time_in_stage_ms BIGINT DEFAULT 0,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pipeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES lead_pipeline(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES pipeline_stages(id),
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    agent_name VARCHAR(100),
    reason TEXT,
    confidence DOUBLE PRECISION DEFAULT 0.5,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_lp_lead ON lead_pipeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_lp_stage ON lead_pipeline(stage_id);
CREATE INDEX IF NOT EXISTS idx_lp_company ON lead_pipeline(company_id);
CREATE INDEX IF NOT EXISTS idx_lp_active ON lead_pipeline(is_deleted, stage_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_pe_lead ON pipeline_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_pe_created ON pipeline_events(created_at DESC);

-- Seed pipeline stages
INSERT INTO pipeline_stages (name, slug, sort_order, color, icon) VALUES
('Discovered', 'discovered', 1, '#6B7280', 'Search'),
('Researched', 'researched', 2, '#3B82F6', 'BookOpen'),
('Audited', 'audited', 3, '#8B5CF6', 'ClipboardCheck'),
('Qualified', 'qualified', 4, '#06B6D4', 'CheckCircle'),
('Prioritised', 'prioritised', 5, '#F59E0B', 'Star'),
('Proposal Ready', 'proposal-ready', 6, '#10B981', 'FileText'),
('Outreach Ready', 'outreach-ready', 7, '#EC4899', 'Send'),
('Follow-up', 'follow-up', 8, '#F97316', 'Clock'),
('Meeting', 'meeting', 9, '#8B5CF6', 'Calendar'),
('Negotiation', 'negotiation', 10, '#EAB308', 'Handshake'),
('Won', 'won', 11, '#22C55E', 'Trophy'),
('Lost', 'lost', 12, '#EF4444', 'XCircle'),
('Archived', 'archived', 13, '#6B7280', 'Archive')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 4: CLIENT READINESS SCORE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS client_readiness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    budget_score DOUBLE PRECISION DEFAULT 0,
    budget_reasoning TEXT,
    urgency_score DOUBLE PRECISION DEFAULT 0,
    urgency_reasoning TEXT,
    growth_score DOUBLE PRECISION DEFAULT 0,
    growth_reasoning TEXT,
    decision_maker_score DOUBLE PRECISION DEFAULT 0,
    decision_maker_reasoning TEXT,
    digital_maturity DOUBLE PRECISION DEFAULT 0,
    digital_maturity_reasoning TEXT,
    sales_readiness DOUBLE PRECISION DEFAULT 0,
    sales_readiness_reasoning TEXT,
    ai_adoption DOUBLE PRECISION DEFAULT 0,
    ai_adoption_reasoning TEXT,
    overall_readiness DOUBLE PRECISION DEFAULT 0,
    recommended_action TEXT,
    recommended_outreach TEXT,
    recommended_proposal_type TEXT,
    recommended_pricing_range TEXT,
    follow_up_strategy TEXT,
    computed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_crs_company ON client_readiness_scores(company_id);
CREATE INDEX IF NOT EXISTS idx_crs_overall ON client_readiness_scores(overall_readiness DESC);
CREATE INDEX IF NOT EXISTS idx_crs_computed ON client_readiness_scores(computed_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 5: AI NEGOTIATION ASSISTANT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS negotiation_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    likely_objections JSONB DEFAULT '[]',
    talking_points JSONB DEFAULT '[]',
    pricing_strategy JSONB DEFAULT '{}',
    upsell_opportunities JSONB DEFAULT '[]',
    cross_sell_opportunities JSONB DEFAULT '[]',
    meeting_agenda JSONB DEFAULT '[]',
    closing_strategy TEXT,
    competitor_weaknesses JSONB DEFAULT '[]',
    recommended_services JSONB DEFAULT '[]',
    ai_model VARCHAR(100),
    raw_ai_response JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_np_company ON negotiation_profiles(company_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 6: LEARNING ENGINE V2
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS learning_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    outcome VARCHAR(50) NOT NULL,
    feature_snapshot JSONB DEFAULT '{}',
    prediction JSONB DEFAULT '{}',
    actual_result JSONB DEFAULT '{}',
    error_margin DOUBLE PRECISION DEFAULT 0,
    agent_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    sample_size INTEGER DEFAULT 0,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ls_type_entity ON learning_signals(signal_type, entity_type);
CREATE INDEX IF NOT EXISTS idx_ls_outcome ON learning_signals(outcome);
CREATE INDEX IF NOT EXISTS idx_ls_created ON learning_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_model ON model_performance(model_name, metric_name);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 8: INTELLIGENT AUTOMATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    trigger_event VARCHAR(100) NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    cooldown_hours INTEGER DEFAULT 24,
    max_executions INTEGER DEFAULT 100,
    total_executions INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    trigger_event VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    conditions_met JSONB DEFAULT '[]',
    actions_executed JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    execution_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ae_rule ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_ae_created ON automation_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ar_active ON automation_rules(is_active, is_deleted) WHERE is_active = TRUE AND is_deleted = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 9: AUTONOMOUS IMPROVEMENT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS improvement_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    system_health JSONB DEFAULT '{}',
    discovery_quality JSONB DEFAULT '{}',
    provider_quality JSONB DEFAULT '{}',
    queue_performance JSONB DEFAULT '{}',
    ai_accuracy JSONB DEFAULT '{}',
    cost_analysis JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    implemented_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ir_date_type ON improvement_reports(report_date, report_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 11: OBSERVABILITY
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_category VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    metric_unit VARCHAR(50),
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sm_category ON system_metrics(metric_category, metric_name);
CREATE INDEX IF NOT EXISTS idx_sm_recorded ON system_metrics(recorded_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE 7: GLOBAL BUSINESS GRAPH (Expansion)
-- ═══════════════════════════════════════════════════════════════════════════

-- New relationship types for the graph
-- company -[IN_INDUSTRY]-> industry
-- company -[LOCATED_IN]-> location
-- company -[USES_TECHNOLOGY]-> technology
-- company -[COMPETES_WITH]-> company
-- company -[OWNED_BY]-> contact
-- company -[HAS_BRAND]-> company
-- company -[IN_CAMPAIGN]-> campaign
-- company -[HAS_PROPOSAL]-> proposal
-- company -[HAS_OPPORTUNITY]-> opportunity
-- lead -[FOR_COMPANY]-> company
-- proposal -[FOR_LEAD]-> lead
