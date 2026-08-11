-- Backfill: add missing leads to lead_pipeline.
-- Any lead whose status is 'New' (or unset) that is not already in the
-- pipeline is assigned to the first active stage (Discovered).
-- Safe to run repeatedly.

INSERT INTO lead_pipeline (id, lead_id, company_id, stage_id,
                           assigned_agent, confidence, entered_at,
                           created_at, updated_at, is_deleted)
SELECT
    gen_random_uuid(),
    l.id,
    l.company_id,
    s.id,
    NULL,
    0.5,
    NOW(),
    NOW(),
    NOW(),
    FALSE
FROM leads l
CROSS JOIN LATERAL (
    SELECT ps.id
    FROM pipeline_stages ps
    WHERE ps.is_active = TRUE
    ORDER BY ps.sort_order ASC
    LIMIT 1
) s
WHERE l.is_deleted = FALSE
  AND l.status IN ('New', 'new', '')
  AND NOT EXISTS (
      SELECT 1 FROM lead_pipeline lp
      WHERE lp.lead_id = l.id AND lp.is_deleted = FALSE
  );

-- Add a PipelineEvent for each newly inserted pipeline entry so the
-- history is consistent.
INSERT INTO pipeline_events (id, lead_id, pipeline_id, from_stage_id,
                             to_stage_id, agent_name, reason, confidence,
                             event_data, created_at, is_deleted)
SELECT
    gen_random_uuid(),
    lp.lead_id,
    lp.id,
    NULL,
    lp.stage_id,
    'crm',
    'Auto-assigned on lead creation backfill',
    0.5,
    '{}'::jsonb,
    NOW(),
    FALSE
FROM lead_pipeline lp
LEFT JOIN pipeline_events pe ON pe.pipeline_id = lp.id
WHERE pe.id IS NULL
  AND lp.is_deleted = FALSE;
