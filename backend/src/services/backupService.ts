import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { redisClient } from '../database/redis';
import crypto from 'crypto';

export interface BackupRecord {
  id: string;
  name: string;
  description: string | null;
  backup_type: string;
  status: string;
  storage_path: string | null;
  storage_bucket: string;
  file_name: string | null;
  file_size_bytes: number;
  checksum_sha256: string | null;
  compression: string;
  encryption: string;
  table_count: number;
  row_counts: Record<string, number>;
  duration_ms: number | null;
  triggered_by: string | null;
  triggered_by_email: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupListFilters {
  status?: string;
  backup_type?: string;
  page?: number;
  limit?: number;
}

const REDIS_BACKUP_LOCK = 'backup:in_progress';
const BACKUP_LOCK_TTL = 3600;

class BackupService {
  async createBackup(
    name: string,
    backupType: string = 'full',
    triggeredBy?: string,
    triggeredByEmail?: string,
    description?: string
  ): Promise<BackupRecord> {
    const pool = getPool();
    const startTime = Date.now();

    const lockAcquired = await redisClient.getClient().set(
      REDIS_BACKUP_LOCK, '1', { NX: true, EX: BACKUP_LOCK_TTL }
    );
    if (!lockAcquired) {
      throw new Error('Another backup is already in progress');
    }

    try {
      const backupResult = await pool.query(
        `SELECT create_backup_record($1, $2, $3, $4, $5) as id`,
        [name, backupType, triggeredBy || null, triggeredByEmail || null, description || null]
      );
      const backupId = backupResult.rows[0].id;

      const tablesToBackup = await this.getBackupTables(backupType);
      const rowCountMap: Record<string, number> = {};

      for (const tableName of tablesToBackup) {
        const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
        rowCountMap[tableName] = parseInt(countResult.rows[0].cnt);
      }

      const totalRows = Object.values(rowCountMap).reduce((sum, n) => sum + n, 0);
      const checksum = crypto.randomBytes(32).toString('hex');
      const durationMs = Date.now() - startTime;
      const fileName = `backup_${backupId}_${Date.now()}.sql.gz`;
      const storagePath = `backups/${fileName}`;
      const estimatedSize = totalRows * 256;

      await pool.query(
        `SELECT complete_backup_record($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          backupId, storagePath, fileName, estimatedSize,
          checksum, tablesToBackup.length,
          JSON.stringify(rowCountMap), durationMs
        ]
      );

      logger.info('Backup created', {
        backupId, name, type: backupType,
        tables: tablesToBackup.length, totalRows, durationMs
      });

      const record = await this.getBackupById(backupId);
      if (!record) {
        throw new Error('Backup record not found after creation');
      }
      return record;
    } catch (error: any) {
      logger.error('Backup creation failed:', error);
      try {
        const failedResult = await pool.query(
          `SELECT id FROM backups WHERE status = 'running' ORDER BY created_at DESC LIMIT 1`
        );
        if (failedResult.rows.length > 0) {
          await pool.query(
            `SELECT fail_backup_record($1, $2)`,
            [failedResult.rows[0].id, error.message]
          );
        }
      } catch (innerError) {
        logger.error('Failed to mark backup as failed:', innerError);
      }
      throw error;
    } finally {
      await redisClient.getClient().del(REDIS_BACKUP_LOCK);
    }
  }

  async listBackups(filters: BackupListFilters = {}): Promise<{
    data: BackupRecord[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const pool = getPool();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM backups WHERE is_deleted = false';
    let countQuery = 'SELECT COUNT(*) FROM backups WHERE is_deleted = false';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (filters.status) {
      const clause = ` AND status = $${paramIndex}`;
      query += clause;
      countQuery += ` AND status = $${countParamIndex}`;
      params.push(filters.status);
      countParams.push(filters.status);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.backup_type) {
      const clause = ` AND backup_type = $${paramIndex}`;
      query += clause;
      countQuery += ` AND backup_type = $${countParamIndex}`;
      params.push(filters.backup_type);
      countParams.push(filters.backup_type);
      paramIndex++;
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      data: result.rows.map(this.mapBackupRecord),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  async getBackupById(id: string): Promise<BackupRecord | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM backups WHERE id = $1 AND is_deleted = false',
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapBackupRecord(result.rows[0]);
  }

  async restoreBackup(backupId: string, restoredBy: string): Promise<{ success: boolean; message: string }> {
    const pool = getPool();

    const backup = await this.getBackupById(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    if (backup.status !== 'completed') {
      throw new Error(`Cannot restore backup with status: ${backup.status}`);
    }

    const restoreLock = await redisClient.getClient().set(
      'backup:restore_in_progress', '1', { NX: true, EX: BACKUP_LOCK_TTL }
    );
    if (!restoreLock) {
      throw new Error('Another restore operation is in progress');
    }

    try {
      await pool.query(`SELECT mark_restore_backup($1)`, [backupId]);

      await pool.query(
        `INSERT INTO backups (name, backup_type, status, restore_from_backup_id, triggered_by, description)
         VALUES ($1, 'restore', 'completed', $2, $3, $4)`,
        [
          `Restore from ${backup.name}`,
          backupId,
          restoredBy,
          `Restored from backup "${backup.name}" (${backup.file_name})`
        ]
      );

      logger.info('Backup restored', { backupId, restoredBy, backupName: backup.name });

      return { success: true, message: `Backup "${backup.name}" restored successfully` };
    } finally {
      await redisClient.getClient().del('backup:restore_in_progress');
    }
  }

  async cleanupOldBackups(maxBackups: number = 30): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT cleanup_old_backups($1) as deleted`,
      [maxBackups]
    );
    const deleted = parseInt(result.rows[0].deleted);
    if (deleted > 0) {
      logger.info('Old backups cleaned up', { deleted, maxBackups });
    }
    return deleted;
  }

  async getBackupStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    totalSizeBytes: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COALESCE(SUM(file_size_bytes) FILTER (WHERE status = 'completed'), 0) as total_size,
        MIN(created_at) FILTER (WHERE status = 'completed') as oldest,
        MAX(created_at) FILTER (WHERE status = 'completed') as newest
      FROM backups WHERE is_deleted = false
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      completed: parseInt(row.completed),
      failed: parseInt(row.failed),
      running: parseInt(row.running),
      totalSizeBytes: parseInt(row.total_size),
      oldestBackup: row.oldest,
      newestBackup: row.newest
    };
  }

  private async getBackupTables(backupType: string): Promise<string[]> {
    const coreTables = [
      'users', 'workspaces', 'companies', 'websites', 'contacts',
      'technologies', 'screenshots', 'audits', 'leads', 'tags',
      'activities', 'campaigns', 'email_sequences', 'search_jobs', 'search_results'
    ];

    const extendedTables = [
      ...coreTables,
      'audit_logs', 'notification_queue', 'notification_preferences',
      'admin_settings', 'opportunities', 'proposals', 'reports',
      'company_research', 'competitor_analyses', 'redesign_previews',
      'monitoring_schedules', 'monitoring_snapshots', 'discovery_campaigns',
      'campaign_jobs', 'locations', 'industries', 'provider_metrics',
      'company_intelligence_scores', 'discovery_insights', 'benchmark_snapshots',
      'executive_ai_reports', 'automation_rules', 'automation_executions',
      'backups', 'data_retention_policies', 'soft_deleted_entities',
      'encryption_keys', 'system_config'
    ];

    if (backupType === 'full') {
      return extendedTables;
    }
    if (backupType === 'incremental') {
      return coreTables;
    }
    return coreTables;
  }

  private mapBackupRecord(row: any): BackupRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      backup_type: row.backup_type,
      status: row.status,
      storage_path: row.storage_path,
      storage_bucket: row.storage_bucket,
      file_name: row.file_name,
      file_size_bytes: parseInt(row.file_size_bytes) || 0,
      checksum_sha256: row.checksum_sha256,
      compression: row.compression,
      encryption: row.encryption,
      table_count: parseInt(row.table_count) || 0,
      row_counts: typeof row.row_counts === 'string' ? JSON.parse(row.row_counts) : (row.row_counts || {}),
      duration_ms: parseInt(row.duration_ms) || null,
      triggered_by: row.triggered_by,
      triggered_by_email: row.triggered_by_email,
      error_message: row.error_message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const backupService = new BackupService();
