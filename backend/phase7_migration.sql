-- Phase 7: Schema reconciliation with SQLAlchemy models (idempotent)
-- Run: psql -U leads -d leads < phase7_migration.sql
--
-- Reconciles column drift between worker/models/__init__.py and the live DB
-- for the module tables created in earlier phases. All statements are
-- idempotent (ALTER ... ADD COLUMN IF NOT EXISTS / RENAME guarded by DO).

BEGIN;

-- ============================================================
-- competitor_analyses: align with CompetitorAnalysis model
-- (legacy columns competitor_ids/comparison_data kept intact)
-- ============================================================
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS competitor_name VARCHAR(255) NOT NULL DEFAULT 'Unknown';
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS competitor_website VARCHAR(500);
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS competitor_industry VARCHAR(100);
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS competitor_location VARCHAR(255);
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS overall_comparison TEXT;
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS strengths_vs_competitor JSONB DEFAULT '[]';
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS weaknesses_vs_competitor JSONB DEFAULT '[]';
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS market_position VARCHAR(100);
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS opportunity_gaps JSONB DEFAULT '[]';
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS pricing_comparison JSONB DEFAULT '{}';

-- ============================================================
-- monitoring_schedules: align with MonitoringSchedule model
-- ============================================================
ALTER TABLE monitoring_schedules ADD COLUMN IF NOT EXISTS alert_on_changes BOOLEAN DEFAULT TRUE;
ALTER TABLE monitoring_schedules ADD COLUMN IF NOT EXISTS monitored_fields JSONB DEFAULT '[]';

-- ============================================================
-- proposals: align with Proposal model
-- (legacy investment_min/max, viewed_at, markdown/docx kept intact)
-- ============================================================
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_amount_min INTEGER DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_amount_max INTEGER DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN DEFAULT FALSE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

-- ============================================================
-- redesign_previews: align with RedesignPreview model
-- ============================================================
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS original_screenshot_url TEXT;
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS preview_screenshot_url TEXT;
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS redesign_style VARCHAR(100);
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{}';
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS changes_made JSONB DEFAULT '[]';
ALTER TABLE redesign_previews ADD COLUMN IF NOT EXISTS generation_cost FLOAT DEFAULT 0;

-- ============================================================
-- reports: align with Report model
-- ============================================================
ALTER TABLE reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS period_start TIMESTAMP;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS period_end TIMESTAMP;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

-- ============================================================
-- search_analytics: align with SearchAnalytics model
-- ============================================================
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS results_count INTEGER DEFAULT 0;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS new_leads_count INTEGER DEFAULT 0;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS duplicates_count INTEGER DEFAULT 0;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS filters_used JSONB DEFAULT '{}';

-- ============================================================
-- lead_pipeline: rename legacy extra_data -> metadata to match
-- LeadPipeline model (Column("metadata", JSONB))
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_pipeline' AND column_name = 'extra_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_pipeline' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE lead_pipeline RENAME COLUMN extra_data TO metadata;
  END IF;
END $$;

-- ============================================================
-- Indexes for the reconciled columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_name ON competitor_analyses(competitor_name);
CREATE INDEX IF NOT EXISTS idx_search_analytics_workspace ON search_analytics(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_schedules_active ON monitoring_schedules(is_active);

COMMIT;
