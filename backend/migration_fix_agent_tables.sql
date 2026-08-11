-- Fix schema drift: agent/knowledge tables created before BaseModel gained
-- id / created_at / updated_at / is_deleted columns. Safe to run repeatedly.

DO $$
DECLARE
  t TEXT;
  c TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agent_states', 'agent_executions', 'agent_memory', 'agent_events',
    'knowledge_edges', 'quality_metrics', 'executive_briefings'
  ] LOOP
    -- id (uuid pk)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4()', t);
    END IF;

    -- created_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'created_at'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
        t
      );
    END IF;

    -- updated_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
        t
      );
    END IF;

    -- is_deleted
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'is_deleted'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false',
        t
      );
    END IF;

    -- created_at/updated_at column type drift (some were TIMESTAMP, some TIMESTAMPTZ)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'created_at'
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE', t);
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'updated_at'
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE', t);
    END IF;

    -- id might exist but not be pk / have a default
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT uuid_generate_v4()', t);
    END IF;
  END LOOP;
END $$;
