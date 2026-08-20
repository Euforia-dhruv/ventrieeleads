-- Migration: Add search area geometry + progress tracking to search_jobs
-- Idempotent: safe to run multiple times

BEGIN;

-- Add search_area column (GeoJSON geometry)
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS search_area JSONB;

-- Add progress tracking columns
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS requested_count INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS discovered_count INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS qualified_count INTEGER DEFAULT 0;
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

-- Add progress stage tracking
ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(50) DEFAULT 'queued';

-- Index for faster progress queries
CREATE INDEX IF NOT EXISTS idx_search_jobs_stage ON search_jobs(progress_stage);

COMMIT;
