-- Phase 5: Performance indexes (idempotent)
-- Run: psql -U leads -d leads < phase5_migration.sql

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Email sequence indexes
CREATE INDEX IF NOT EXISTS idx_email_sequences_lead_id ON email_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_campaign_id ON email_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_status ON email_sequences(status);

-- Search result indexes
CREATE INDEX IF NOT EXISTS idx_search_results_is_duplicate ON search_results(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_search_results_processed ON search_results(processed);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Company research indexes
CREATE INDEX IF NOT EXISTS idx_company_research_company_id ON company_research(company_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_company_id ON competitor_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_redesign_previews_company_id ON redesign_previews(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Monitoring indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_snapshots_schedule_id ON monitoring_snapshots(schedule_id);

-- Report indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Search analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at DESC);

-- Companies monitoring
CREATE INDEX IF NOT EXISTS idx_companies_is_monitored ON companies(is_monitored) WHERE is_monitored = true;

-- Composite index for lead lookup
CREATE INDEX IF NOT EXISTS idx_leads_workspace_company ON leads(workspace_id, company_id);

-- Opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_id ON opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON opportunities(score DESC NULLS LAST);

-- Admin settings
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);
