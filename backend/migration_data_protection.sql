-- Data Protection & Backup System Migration
-- Backups, retention policies, soft delete recovery, encryption keys

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. BACKUPS TABLE – tracks every backup/restore event
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    backup_type VARCHAR(50) NOT NULL DEFAULT 'full',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    storage_path TEXT,
    storage_bucket VARCHAR(255) DEFAULT 'backups',
    file_name VARCHAR(500),
    file_size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    compression VARCHAR(20) DEFAULT 'gzip',
    encryption VARCHAR(50) DEFAULT 'aes-256',
    table_count INTEGER DEFAULT 0,
    row_counts JSONB DEFAULT '{}',
    duration_ms INTEGER,
    triggered_by UUID,
    triggered_by_email VARCHAR(255),
    restore_from_backup_id UUID,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_backup_type ON backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_storage_path ON backups(storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backups_active ON backups(is_deleted, status) WHERE is_deleted = false;

-- ═══════════════════════════════════════════════════════════════
-- 2. DATA RETENTION POLICIES TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 365,
    column_used_for_ageing VARCHAR(255) DEFAULT 'created_at',
    soft_delete_only BOOLEAN DEFAULT false,
    preserve_latest_n INTEGER DEFAULT 0,
    exclude_workspaces UUID[] DEFAULT '{}',
    last_cleanup_at TIMESTAMP,
    rows_deleted_total BIGINT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drp_table ON data_retention_policies(table_name);
CREATE INDEX IF NOT EXISTS idx_drp_enabled ON data_retention_policies(is_enabled) WHERE is_enabled = true;

-- Seed default retention policies for core tables
INSERT INTO data_retention_policies (table_name, retention_days, column_used_for_ageing, soft_delete_only, description)
VALUES
    ('audit_logs', 365, 'created_at', false, 'Audit logs retained for 1 year'),
    ('search_jobs', 180, 'created_at', false, 'Search jobs retained for 6 months'),
    ('search_results', 180, 'created_at', false, 'Search results retained for 6 months'),
    ('email_sequences', 365, 'created_at', true, 'Email sequences (soft deleted only)'),
    ('activities', 730, 'created_at', false, 'Activity history retained for 2 years'),
    ('notification_queue', 90, 'created_at', false, 'Notifications retained for 90 days'),
    ('executive_ai_reports', 365, 'created_at', false, 'Executive reports retained for 1 year'),
    ('backups', 180, 'created_at', false, 'Backup metadata retained for 6 months'),
    ('soft_deleted_entities', 90, 'deleted_at', false, 'Soft deleted entities purged after 90 days')
ON CONFLICT (table_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. SOFT DELETE RECOVERY MECHANISM
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS soft_deleted_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(500),
    original_data JSONB NOT NULL,
    deleted_by UUID,
    deleted_by_email VARCHAR(255),
    delete_reason TEXT,
    restored_at TIMESTAMP,
    restored_by UUID,
    purge_after TIMESTAMP NOT NULL,
    is_purged BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sde_table ON soft_deleted_entities(table_name);
CREATE INDEX IF NOT EXISTS idx_sde_entity ON soft_deleted_entities(table_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_sde_purge ON soft_deleted_entities(purge_after) WHERE is_purged = false;
CREATE INDEX IF NOT EXISTS idx_sde_restored ON soft_deleted_entities(restored_at) WHERE restored_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 4. ENCRYPTION KEYS TABLE (for at-rest encryption)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_alias VARCHAR(255) NOT NULL UNIQUE,
    key_type VARCHAR(50) NOT NULL DEFAULT 'aes-256',
    key_hash VARCHAR(64) NOT NULL,
    key_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    rotated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ek_alias ON encryption_keys(key_alias);
CREATE INDEX IF NOT EXISTS idx_ek_active ON encryption_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ek_version ON encryption_keys(key_alias, key_version DESC);

-- ═══════════════════════════════════════════════════════════════
-- 5. MAINTENANCE MODE TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_config (key, value, description)
VALUES
    ('maintenance_mode', '{"enabled": false, "message": "System under maintenance. Please try again later."}', 'Toggle maintenance mode'),
    ('backup_schedule', '{"cron": "0 2 * * *", "enabled": true, "max_backups": 30}', 'Automatic backup schedule config'),
    ('retention_enabled', '{"enabled": true, "last_run": null}', 'Global data retention toggle')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 6. DATABASE BACKUP/RESTORE STORED PROCEDURES
-- ═══════════════════════════════════════════════════════════════

-- Record a new backup entry and return its id
CREATE OR REPLACE FUNCTION create_backup_record(
    p_name VARCHAR(255),
    p_backup_type VARCHAR(50) DEFAULT 'full',
    p_triggered_by UUID DEFAULT NULL,
    p_triggered_by_email VARCHAR(255) DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_backup_id UUID;
BEGIN
    INSERT INTO backups (name, backup_type, status, triggered_by, triggered_by_email, description)
    VALUES (p_name, p_backup_type, 'running', p_triggered_by, p_triggered_by_email, p_description)
    RETURNING id INTO v_backup_id;

    PERFORM pg_notify('backup_started', json_build_object('backup_id', v_backup_id, 'name', p_name)::text);

    RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql;

-- Mark a backup as completed
CREATE OR REPLACE FUNCTION complete_backup_record(
    p_backup_id UUID,
    p_storage_path TEXT,
    p_file_name VARCHAR(500),
    p_file_size_bytes BIGINT,
    p_checksum_sha256 VARCHAR(64),
    p_table_count INTEGER,
    p_row_counts JSONB,
    p_duration_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE backups
    SET status = 'completed',
        storage_path = p_storage_path,
        file_name = p_file_name,
        file_size_bytes = p_file_size_bytes,
        checksum_sha256 = p_checksum_sha256,
        table_count = p_table_count,
        row_counts = p_row_counts,
        duration_ms = p_duration_ms,
        updated_at = NOW()
    WHERE id = p_backup_id;

    PERFORM pg_notify('backup_completed', json_build_object('backup_id', p_backup_id)::text);
END;
$$ LANGUAGE plpgsql;

-- Mark a backup as failed
CREATE OR REPLACE FUNCTION fail_backup_record(
    p_backup_id UUID,
    p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE backups
    SET status = 'failed',
        error_message = p_error_message,
        updated_at = NOW()
    WHERE id = p_backup_id;

    PERFORM pg_notify('backup_failed', json_build_object('backup_id', p_backup_id, 'error', p_error_message)::text);
END;
$$ LANGUAGE plpgsql;

-- Restore from backup: mark backup as restore source
CREATE OR REPLACE FUNCTION mark_restore_backup(
    p_backup_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM backups WHERE id = p_backup_id AND status = 'completed' AND is_deleted = false)
    INTO v_exists;

    IF NOT v_exists THEN
        RETURN false;
    END IF;

    UPDATE backups
    SET status = 'restored',
        updated_at = NOW()
    WHERE id = p_backup_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Record a soft-deleted entity for potential recovery
CREATE OR REPLACE FUNCTION record_soft_delete(
    p_table_name VARCHAR(255),
    p_entity_id UUID,
    p_entity_name VARCHAR(500),
    p_original_data JSONB,
    p_deleted_by UUID DEFAULT NULL,
    p_deleted_by_email VARCHAR(255) DEFAULT NULL,
    p_delete_reason TEXT DEFAULT NULL,
    p_retention_days INTEGER DEFAULT 90
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO soft_deleted_entities (
        table_name, entity_id, entity_name, original_data,
        deleted_by, deleted_by_email, delete_reason,
        purge_after
    )
    VALUES (
        p_table_name, p_entity_id, p_entity_name, p_original_data,
        p_deleted_by, p_deleted_by_email, p_delete_reason,
        NOW() + (p_retention_days || ' days')::INTERVAL
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Recover a soft-deleted entity
CREATE OR REPLACE FUNCTION recover_soft_deleted_entity(
    p_sde_id UUID,
    p_restored_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_entity RECORD;
    v_result JSONB;
BEGIN
    SELECT * INTO v_entity
    FROM soft_deleted_entities
    WHERE id = p_sde_id AND is_purged = false AND restored_at IS NULL;

    IF NOT FOUND THEN
        RETURN '{"error": "Entity not found or already restored/purged"}'::jsonb;
    END IF;

    UPDATE soft_deleted_entities
    SET restored_at = NOW(),
        restored_by = p_restored_by,
        updated_at = NOW()
    WHERE id = p_sde_id;

    v_result := json_build_object(
        'table_name', v_entity.table_name,
        'entity_id', v_entity.entity_id,
        'original_data', v_entity.original_data
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 7. DATA RETENTION CLEANUP FUNCTION
-- ═══════════════════════════════════════════════════════════════

-- Purge expired soft-deleted entities
CREATE OR REPLACE FUNCTION purge_expired_soft_deletes()
RETURNS TABLE(table_name TEXT, entities_purged BIGINT) AS $$
DECLARE
    v_record RECORD;
    v_count BIGINT;
BEGIN
    FOR v_record IN
        SELECT DISTINCT table_name FROM soft_deleted_entities
        WHERE is_purged = false AND purge_after <= NOW()
    LOOP
        EXECUTE format(
            'DELETE FROM %I WHERE id IN (
                SELECT entity_id FROM soft_deleted_entities
                WHERE table_name = %L AND is_purged = false AND purge_after <= NOW()
            )',
            v_record.table_name, v_record.table_name
        );

        GET DIAGNOSTICS v_count = ROW_COUNT;

        UPDATE soft_deleted_entities
        SET is_purged = true, updated_at = NOW()
        WHERE table_name = v_record.table_name AND is_purged = false AND purge_after <= NOW();

        table_name := v_record.table_name;
        entities_purged := v_count;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Apply retention policy for a single table
CREATE OR REPLACE FUNCTION apply_retention_policy(p_table_name VARCHAR(255))
RETURNS BIGINT AS $$
DECLARE
    v_policy RECORD;
    v_cutoff TIMESTAMP;
    v_deleted BIGINT;
BEGIN
    SELECT * INTO v_policy
    FROM data_retention_policies
    WHERE table_name = p_table_name AND is_enabled = true;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_cutoff := NOW() - (v_policy.retention_days || ' days')::INTERVAL;

    IF v_policy.soft_delete_only THEN
        EXECUTE format(
            'DELETE FROM %I WHERE is_deleted = true AND %I < $1',
            v_policy.table_name, v_policy.column_used_for_ageing
        ) USING v_cutoff;
    ELSE
        EXECUTE format(
            'DELETE FROM %I WHERE %I < $1 AND is_deleted = true',
            v_policy.table_name, v_policy.column_used_for_ageing
        ) USING v_cutoff;
    END IF;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    UPDATE data_retention_policies
    SET last_cleanup_at = NOW(),
        rows_deleted_total = rows_deleted_total + v_deleted,
        updated_at = NOW()
    WHERE table_name = p_table_name;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Run all active retention policies
CREATE OR REPLACE FUNCTION run_all_retention_policies()
RETURNS TABLE(table_name TEXT, rows_deleted BIGINT) AS $$
DECLARE
    v_record RECORD;
    v_count BIGINT;
BEGIN
    FOR v_record IN
        SELECT table_name FROM data_retention_policies
        WHERE is_enabled = true
    LOOP
        SELECT apply_retention_policy(v_record.table_name) INTO v_count;

        table_name := v_record.table_name;
        rows_deleted := v_count;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old backups beyond retention limit
CREATE OR REPLACE FUNCTION cleanup_old_backups(p_max_backups INTEGER DEFAULT 30)
RETURNS BIGINT AS $$
DECLARE
    v_deleted BIGINT;
BEGIN
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
        FROM backups
        WHERE is_deleted = false AND status = 'completed'
    )
    UPDATE backups SET is_deleted = true, updated_at = NOW()
    WHERE id IN (SELECT id FROM ranked WHERE rn > p_max_backups);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Get comprehensive database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    index_size TEXT,
    dead_tuples BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.oid::regclass::text AS table_name,
        COALESCE(s.n_live_tup, 0) AS row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
        pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
        COALESCE(s.n_dead_tup, 0) AS dead_tuples
    FROM pg_class c
    LEFT JOIN pg_stat_user_tables s ON s.relname = c.oid::regclass::text
    WHERE c.relkind = 'r'
        AND c.oid::regclass::text NOT LIKE 'pg_%'
        AND c.oid::regclass::text NOT LIKE 'sql_%'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Get active connection stats
CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS TABLE(
    state TEXT,
    count BIGINT,
    max_duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(state, 'unknown') AS state,
        COUNT(*)::bigint AS count,
        MAX(NOW() - state_change) AS max_duration
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY COALESCE(state, 'unknown');
END;
$$ LANGUAGE plpgsql;

COMMIT;
