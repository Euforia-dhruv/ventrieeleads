-- Backfill existing leads into the CRM pipeline (safe to run repeatedly).
-- Maps the legacy lead.status value to the matching pipeline stage slug so the
-- pipeline board is populated for pre-existing leads. New leads are added to the
-- pipeline automatically by the worker (process.py / crm.py).

INSERT INTO lead_pipeline (lead_id, company_id, stage_id, confidence, estimated_value_min, estimated_value_max, created_at, updated_at)
SELECT
  l.id,
  l.company_id,
  ps.id,
  0.5,
  COALESCE((l.metadata->>'estimated_value_min')::int, 0),
  COALESCE((l.metadata->>'estimated_value_max')::int, 0),
  l.created_at,
  l.created_at
FROM leads l
JOIN pipeline_stages ps
  ON ps.slug = CASE
    WHEN LOWER(COALESCE(l.status, 'New')) IN ('discovered', 'new') THEN 'discovered'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'researched' THEN 'researched'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'audited' THEN 'audited'
    WHEN LOWER(COALESCE(l.status, 'New')) IN ('qualified', 'researching') THEN 'qualified'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'prioritised' THEN 'prioritised'
    WHEN LOWER(COALESCE(l.status, 'New')) IN ('proposal', 'proposal ready') THEN 'proposal-ready'
    WHEN LOWER(COALESCE(l.status, 'New')) IN ('contacted', 'outreach ready', 'replied') THEN 'outreach-ready'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'follow-up' THEN 'follow-up'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'meeting' THEN 'meeting'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'negotiation' THEN 'negotiation'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'won' THEN 'won'
    WHEN LOWER(COALESCE(l.status, 'New')) = 'lost' THEN 'lost'
    ELSE 'discovered'
  END
  AND ps.is_deleted = FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM lead_pipeline lp WHERE lp.lead_id = l.id AND lp.is_deleted = FALSE
)
  AND l.is_deleted = FALSE;
