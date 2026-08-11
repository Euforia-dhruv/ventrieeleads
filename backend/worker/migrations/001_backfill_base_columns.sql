-- Migration: bring existing tables in sync with BaseModel (id, created_at, updated_at, is_deleted)
-- BaseModel gained these columns but create_all does not ALTER existing tables.
-- Idempotent: safe to run multiple times.

-- AdminSetting
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- AutomationExecution
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- CampaignLead (missing all three)
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS created_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ChangeHistory
ALTER TABLE change_history ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE change_history ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ExportHistory
ALTER TABLE export_history ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE export_history ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ImprovementReport
ALTER TABLE improvement_reports ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- LeadTask
ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- LearningSignal
ALTER TABLE learning_signals ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- ScheduledSearch
ALTER TABLE scheduled_searches ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- SearchPreset
ALTER TABLE search_presets ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ModelPerformance
ALTER TABLE model_performance ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- MonitoringSnapshot
ALTER TABLE monitoring_snapshots ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE monitoring_snapshots ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Notification
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- PipelineEvent (blocking CRM pipeline insert)
ALTER TABLE pipeline_events ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- SearchAnalytics
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- SystemMetric (blocking search-job metric recording)
ALTER TABLE system_metrics ADD COLUMN IF NOT EXISTS created_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE system_metrics ADD COLUMN IF NOT EXISTS updated_at timestamp WITHOUT TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE system_metrics ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
