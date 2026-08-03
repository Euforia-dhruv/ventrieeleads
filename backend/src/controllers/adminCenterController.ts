import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { redisClient } from '../database/redis';
import { backupService } from '../services/backupService';
import { AuthRequest } from '../middleware/auth';

// ─── GET /admin/users ──────────────────────────────────────────────────────

export async function listAdminUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    let query = `
      SELECT u.id, u.email, u.name, u.role, u.is_active, u.workspace_id,
             u.is_deleted, u.created_at, u.updated_at,
             w.name as workspace_name, w.slug as workspace_slug,
             (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = u.workspace_id AND l.is_deleted = false) as workspace_lead_count
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.is_deleted = false
    `;
    let countQuery = 'SELECT COUNT(*) FROM users WHERE is_deleted = false';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (search) {
      const clause = ` AND (u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`;
      query += clause;
      countQuery += ` AND (email ILIKE $${countParamIndex} OR name ILIKE $${countParamIndex})`;
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (role) {
      const clause = ` AND u.role = $${paramIndex}`;
      query += clause;
      countQuery += ` AND role = $${countParamIndex}`;
      params.push(role);
      countParams.push(role);
      paramIndex++;
      countParamIndex++;
    }

    if (status === 'active') {
      query += ` AND u.is_active = true`;
      countQuery += ` AND is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND u.is_active = false`;
      countQuery += ` AND is_active = false`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error listing admin users:', error);
    res.status(500).json({ success: false, message: 'Failed to list users' });
  }
}

// ─── PUT /admin/users/:id ─────────────────────────────────────────────────

export async function updateUserRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { role, is_active, name } = req.body;

    const allowedFields = ['role', 'is_active', 'name'];
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (role !== undefined) {
      const validRoles = ['super_admin', 'admin', 'user', 'viewer'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        return;
      }
      sets.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (is_active !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update' });
      return;
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex} AND is_deleted = false
       RETURNING id, email, name, role, is_active, workspace_id, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    logger.info('Admin updated user', {
      adminId: req.user?.id,
      targetUserId: id,
      changes: Object.keys(req.body).filter(k => req.body[k] !== undefined)
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
}

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────

export async function softDeleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    if (id === req.user?.id) {
      res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      return;
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    await pool.query(
      `SELECT record_soft_delete('users', $1, $2, $3, $4, $5, $6)`,
      [
        id, user.email, JSON.stringify(user),
        req.user?.id, req.user?.email, 'Admin soft delete'
      ]
    );

    await pool.query(
      `UPDATE users SET is_deleted = true, is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    logger.warn('Admin soft-deleted user', {
      adminId: req.user?.id,
      targetUserId: id,
      targetEmail: user.email
    });

    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Error soft-deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
}

// ─── GET /admin/workspaces ────────────────────────────────────────────────

export async function listWorkspaces(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM workspaces WHERE is_deleted = false');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id AND u.is_deleted = false) as user_count,
        (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = w.id AND l.is_deleted = false) as lead_count,
        (SELECT COUNT(*) FROM campaigns c WHERE c.workspace_id = w.id AND c.is_deleted = false) as campaign_count
      FROM workspaces w
      WHERE w.is_deleted = false
      ORDER BY w.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error listing workspaces:', error);
    res.status(500).json({ success: false, message: 'Failed to list workspaces' });
  }
}

// ─── PUT /admin/workspaces/:id ────────────────────────────────────────────

export async function updateWorkspace(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, description, settings } = req.body;

    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (settings !== undefined) {
      sets.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(settings));
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update' });
      return;
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE workspaces SET ${sets.join(', ')} WHERE id = $${paramIndex} AND is_deleted = false RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating workspace:', error);
    res.status(500).json({ success: false, message: 'Failed to update workspace' });
  }
}

// ─── GET /admin/providers ─────────────────────────────────────────────────

export async function getProviderConfigs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const providers = await pool.query(`
      SELECT pm.provider_slug,
        pm.country_code,
        pm.total_requests,
        pm.successful_requests,
        pm.failed_requests,
        pm.avg_latency_ms,
        pm.avg_results_per_request,
        pm.duplicate_rate,
        pm.last_error,
        pm.last_used_at
      FROM provider_metrics pm
      WHERE pm.is_deleted = false
      ORDER BY pm.provider_slug, pm.country_code
    `);

    const aggregated: Record<string, any> = {};
    for (const row of providers.rows) {
      if (!aggregated[row.provider_slug]) {
        aggregated[row.provider_slug] = {
          slug: row.provider_slug,
          total_requests: 0,
          successful: 0,
          failed: 0,
          avg_latency_ms: 0,
          countries: 0,
          last_error: null,
          countries_detail: []
        };
      }
      const p = aggregated[row.provider_slug];
      p.total_requests += row.total_requests;
      p.successful += row.successful_requests;
      p.failed += row.failed_requests;
      p.avg_latency_ms += row.avg_latency_ms * row.total_requests;
      p.countries++;
      if (row.last_error) p.last_error = row.last_error;
      p.countries_detail.push({
        country_code: row.country_code,
        requests: row.total_requests,
        success_rate: row.total_requests > 0
          ? Math.round(row.successful_requests / row.total_requests * 1000) / 1000
          : 0,
        avg_latency: row.avg_latency_ms
      });
    }

    for (const p of Object.values(aggregated) as any[]) {
      p.avg_latency_ms = p.total_requests > 0
        ? Math.round(p.avg_latency_ms / p.total_requests)
        : 0;
      p.success_rate = p.total_requests > 0
        ? Math.round(p.successful / p.total_requests * 1000) / 1000
        : 0;
    }

    const envProviders = {
      openai: { configured: !!process.env.OPENAI_API_KEY },
      gemini: { configured: !!process.env.GEMINI_API_KEY },
      ollama: { configured: !!process.env.OLLAMA_URL }
    };

    res.json({
      success: true,
      data: { providers: Object.values(aggregated), env_config: envProviders }
    });
  } catch (error) {
    logger.error('Error getting provider configs:', error);
    res.status(500).json({ success: false, message: 'Failed to get provider configs' });
  }
}

// ─── PUT /admin/providers/:slug ──────────────────────────────────────────

export async function updateProviderConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const slug = String(req.params.slug);
    const { api_key, base_url, enabled } = req.body;

    const envKeyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      ollama: 'OLLAMA_URL'
    };

    const envVar = envKeyMap[slug];
    if (!envVar) {
      res.status(400).json({ success: false, message: `Unknown provider: ${slug}` });
      return;
    }

    const updates: Record<string, any> = {};
    if (api_key && envVar) {
      process.env[envVar] = api_key;
      updates[envVar] = '***updated***';
    }
    if (base_url) {
      const baseUrlEnvVar = `${slug.toUpperCase()}_BASE_URL`;
      process.env[baseUrlEnvVar] = base_url;
      updates[baseUrlEnvVar] = base_url;
    }

    logger.warn('Provider config updated via admin', {
      adminId: req.user?.id, provider: slug, keys: Object.keys(updates)
    });

    res.json({
      success: true,
      data: { slug, updated: true, changes: Object.keys(updates) },
      message: 'Provider configuration updated. Changes apply to new requests.'
    });
  } catch (error) {
    logger.error('Error updating provider config:', error);
    res.status(500).json({ success: false, message: 'Failed to update provider config' });
  }
}

// ─── GET /admin/queues ────────────────────────────────────────────────────

export async function getQueueStatus(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const client = redisClient.getClient();

    const [runningJobs, queuedJobs, completedToday, failedToday] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'running'"),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'queued'"),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'completed' AND completed_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'failed' AND updated_at >= CURRENT_DATE")
    ]);

    let redisQueues: Record<string, any> = {};
    try {
      const keys = await client.keys('queue:*');
      for (const key of keys) {
        if (key.includes(':')) continue;
        const queueName = key.replace('queue:', '');
        const length = await client.lLen(key);
        redisQueues[queueName] = { length };
      }
    } catch {
      redisQueues = { note: 'Redis queue stats unavailable' };
    }

    let campaignJobs: Record<string, number> = {};
    try {
      const jobStatuses = await pool.query(`
        SELECT status, COUNT(*) as count FROM campaign_jobs
        WHERE is_deleted = false
        GROUP BY status
      `);
      for (const row of jobStatuses.rows) {
        campaignJobs[row.status] = parseInt(row.count);
      }
    } catch {
      campaignJobs = {};
    }

    res.json({
      success: true,
      data: {
        search_jobs: {
          running: parseInt(runningJobs.rows[0].count),
          queued: parseInt(queuedJobs.rows[0].count),
          completed_today: parseInt(completedToday.rows[0].count),
          failed_today: parseInt(failedToday.rows[0].count)
        },
        campaign_jobs: campaignJobs,
        redis_queues: redisQueues
      }
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({ success: false, message: 'Failed to get queue status' });
  }
}

// ─── GET /admin/workers ───────────────────────────────────────────────────

export async function getWorkerDetails(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const client = redisClient.getClient();

    const jobStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= CURRENT_DATE) as failed_today,
        COUNT(*) as total
      FROM search_jobs
    `);

    const campaignStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= CURRENT_DATE) as failed_today
      FROM campaign_jobs WHERE is_deleted = false
    `);

    let redisWorkers: Record<string, any> = {};
    try {
      const workerKeys = await client.keys('worker:*');
      for (const key of workerKeys) {
        const workerId = key.replace('worker:', '');
        const info = await client.hGetAll(key);
        redisWorkers[workerId] = {
          status: info.status || 'unknown',
          tasks_completed: parseInt(info.tasks_completed || '0'),
          tasks_failed: parseInt(info.tasks_failed || '0'),
          last_heartbeat: info.last_heartbeat || null
        };
      }
    } catch {
      redisWorkers = {};
    }

    const mem = process.memoryUsage();

    res.json({
      success: true,
      data: {
        search_workers: jobStats.rows[0],
        campaign_workers: campaignStats.rows[0],
        redis_workers: redisWorkers,
        process: {
          uptime_seconds: Math.round(process.uptime()),
          memory_mb: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heap_used: Math.round(mem.heapUsed / 1024 / 1024),
            heap_total: Math.round(mem.heapTotal / 1024 / 1024),
            external: Math.round(mem.external / 1024 / 1024)
          },
          pid: process.pid,
          node_version: process.version
        }
      }
    });
  } catch (error) {
    logger.error('Error getting worker details:', error);
    res.status(500).json({ success: false, message: 'Failed to get worker details' });
  }
}

// ─── GET /admin/storage ───────────────────────────────────────────────────

export async function getStorageStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const dbSize = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
    const tableSizes = await pool.query(`
      SELECT
        schemaname || '.' || tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
        pg_size_pretty(pg_indexes_size((schemaname || '.' || tablename)::regclass)) as index_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 20
    `);

    let minioStats: Record<string, any> = {};
    try {
      const buckets = ['leads', 'screenshots', 'logos', 'files', 'backups'];
      for (const bucket of buckets) {
        try {
          const { minioClient } = require('../database/minio');
          const mc = minioClient.getClient();
          const objects: string[] = [];
          const stream = mc.listObjects(bucket, '', true);
          await new Promise<void>((resolve) => {
            stream.on('data', (obj: any) => objects.push(obj.name));
            stream.on('end', resolve);
            stream.on('error', resolve);
          });
          minioStats[bucket] = { objects: objects.length };
        } catch {
          minioStats[bucket] = { objects: 0, note: 'unavailable' };
        }
      }
    } catch {
      minioStats = { note: 'MinIO unavailable' };
    }

    res.json({
      success: true,
      data: {
        database: {
          total_size: dbSize.rows[0].size,
          tables: tableSizes.rows
        },
        minio: minioStats,
        backup_storage: await backupService.getBackupStats()
      }
    });
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get storage stats' });
  }
}

// ─── GET /admin/logs ──────────────────────────────────────────────────────

export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const eventType = req.query.event_type as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const userId = req.query.user_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      countQuery += ` AND category = $${countParamIndex}`;
      params.push(category);
      countParams.push(category);
      paramIndex++;
      countParamIndex++;
    }

    if (eventType) {
      query += ` AND event_type = $${paramIndex}`;
      countQuery += ` AND event_type = $${countParamIndex}`;
      params.push(eventType);
      countParams.push(eventType);
      paramIndex++;
      countParamIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${countParamIndex}`;
      params.push(status);
      countParams.push(status);
      paramIndex++;
      countParamIndex++;
    }

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      countQuery += ` AND user_id = $${countParamIndex}`;
      params.push(userId);
      countParams.push(userId);
      paramIndex++;
      countParamIndex++;
    }

    if (search) {
      const clause = ` AND (description ILIKE $${paramIndex} OR user_email ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`;
      query += clause;
      countQuery += clause;
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      countQuery += ` AND created_at >= $${countParamIndex}`;
      params.push(startDate);
      countParams.push(startDate);
      paramIndex++;
      countParamIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      countQuery += ` AND created_at <= $${countParamIndex}`;
      params.push(endDate);
      countParams.push(endDate);
      paramIndex++;
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const logs = result.rows.map((row: any) => ({
      ...row,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to get audit logs' });
  }
}

// ─── GET /admin/backups ───────────────────────────────────────────────────

export async function getBackupHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const backupType = req.query.backup_type as string;

    const result = await backupService.listBackups({ status, backup_type: backupType, page, limit });
    const stats = await backupService.getBackupStats();

    res.json({
      success: true,
      data: result.data,
      stats,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: result.pages
      }
    });
  } catch (error) {
    logger.error('Error getting backup history:', error);
    res.status(500).json({ success: false, message: 'Failed to get backup history' });
  }
}

// ─── POST /admin/backups ─────────────────────────────────────────────────

export async function createBackup(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, backup_type = 'full', description } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Backup name is required' });
      return;
    }

    const backup = await backupService.createBackup(
      name, backup_type, req.user?.id, req.user?.email, description
    );

    res.status(201).json({ success: true, data: backup });
  } catch (error: any) {
    logger.error('Error creating backup:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create backup' });
  }
}

// ─── GET /admin/metrics ──────────────────────────────────────────────────

export async function getSystemMetrics(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const client = redisClient.getClient();

    const [
      totalUsers, activeUsers, totalLeads, totalCompanies,
      totalCampaigns, totalSearchJobs, totalAudits, totalProposals
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM users WHERE is_deleted = false AND is_active = true'),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM campaigns WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM search_jobs WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM audits WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM proposals WHERE is_deleted = false')
    ]);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();

    const [newLeadsWeek, newLeadsDay, newCompaniesWeek, completedJobsWeek] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false AND created_at > $1', [weekAgo]),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false AND created_at > $1', [dayAgo]),
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = false AND created_at > $1', [weekAgo]),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'completed' AND completed_at > $1", [weekAgo])
    ]);

    let redisInfo: Record<string, any> = {};
    try {
      const info = await client.info('memory');
      const usedMem = info.match(/used_memory_human:(.*)/);
      redisInfo = {
        connected: true,
        memory_used: usedMem ? usedMem[1].trim() : 'unknown'
      };
    } catch {
      redisInfo = { connected: false };
    }

    const dbPool = getPool();
    const poolStats = {
      total: (dbPool as any).totalCount || 0,
      idle: (dbPool as any).idleCount || 0,
      waiting: (dbPool as any).waitingCount || 0
    };

    const mem = process.memoryUsage();

    res.json({
      success: true,
      data: {
        counts: {
          users: parseInt(totalUsers.rows[0].count),
          active_users: parseInt(activeUsers.rows[0].count),
          leads: parseInt(totalLeads.rows[0].count),
          companies: parseInt(totalCompanies.rows[0].count),
          campaigns: parseInt(totalCampaigns.rows[0].count),
          search_jobs: parseInt(totalSearchJobs.rows[0].count),
          audits: parseInt(totalAudits.rows[0].count),
          proposals: parseInt(totalProposals.rows[0].count)
        },
        activity: {
          new_leads_week: parseInt(newLeadsWeek.rows[0].count),
          new_leads_day: parseInt(newLeadsDay.rows[0].count),
          new_companies_week: parseInt(newCompaniesWeek.rows[0].count),
          completed_jobs_week: parseInt(completedJobsWeek.rows[0].count)
        },
        infrastructure: {
          redis: redisInfo,
          database_pool: poolStats,
          process: {
            uptime_seconds: Math.round(process.uptime()),
            memory_mb: Math.round(mem.rss / 1024 / 1024),
            heap_mb: Math.round(mem.heapUsed / 1024 / 1024),
            pid: process.pid
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error getting system metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to get system metrics' });
  }
}

// ─── GET /admin/database ─────────────────────────────────────────────────

export async function getDatabaseStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const tableStats = await pool.query(`
      SELECT
        c.oid::regclass::text as table_name,
        COALESCE(s.n_live_tup, 0) as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
        COALESCE(s.n_dead_tup, 0) as dead_tuples,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size
      FROM pg_class c
      LEFT JOIN pg_stat_user_tables s ON s.relname = c.oid::regclass::text
      WHERE c.relkind = 'r'
        AND c.oid::regclass::text NOT LIKE 'pg_%'
        AND c.oid::regclass::text NOT LIKE 'sql_%'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);

    const dbSize = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");

    const connectionStats = await pool.query(`
      SELECT
        COALESCE(state, 'unknown') as state,
        COUNT(*)::bigint as count,
        MAX(NOW() - state_change) as max_duration
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY COALESCE(state, 'unknown')
    `);

    const indexStats = await pool.query(`
      SELECT
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan as times_used
      FROM pg_stat_user_indexes
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 15
    `);

    const slowQueries = await pool.query(`
      SELECT
        calls,
        round(total_exec_time::numeric, 2) as total_ms,
        round(mean_exec_time::numeric, 2) as avg_ms,
        round(max_exec_time::numeric, 2) as max_ms,
        rows,
        LEFT(query, 200) as query_preview
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    const deadTuples = await pool.query(`
      SELECT
        relname as table_name,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        CASE WHEN n_live_tup > 0
          THEN round(n_dead_tup::numeric / n_live_tup * 100, 2)
          ELSE 0
        END as dead_ratio_pct
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 100
      ORDER BY n_dead_tup DESC
      LIMIT 10
    `);

    const poolInfo = getPool();
    const poolStats = {
      total: (poolInfo as any).totalCount || 0,
      idle: (poolInfo as any).idleCount || 0,
      waiting: (poolInfo as any).waitingCount || 0
    };

    res.json({
      success: true,
      data: {
        database_size: dbSize.rows[0].size,
        tables: tableStats.rows,
        connections: connectionStats.rows,
        top_indexes: indexStats.rows,
        slow_queries: slowQueries.rows,
        dead_tuple_tables: deadTuples.rows,
        connection_pool: poolStats
      }
    });
  } catch (error) {
    logger.error('Error getting database stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get database stats' });
  }
}

// ─── POST /admin/maintenance ─────────────────────────────────────────────

export async function toggleMaintenance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { enabled, message: maintenanceMessage } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, message: 'enabled must be a boolean' });
      return;
    }

    const currentValue = await pool.query(
      `SELECT value FROM system_config WHERE key = 'maintenance_mode'`
    );

    const previousState = currentValue.rows.length > 0
      ? (typeof currentValue.rows[0].value === 'string'
          ? JSON.parse(currentValue.rows[0].value)
          : currentValue.rows[0].value)
      : { enabled: false };

    await pool.query(`
      INSERT INTO system_config (key, value, description, updated_by, updated_at)
      VALUES ('maintenance_mode', $1, 'Toggle maintenance mode', $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = $1, updated_by = $2, updated_at = NOW()
    `, [
      JSON.stringify({
        enabled,
        message: maintenanceMessage || 'System under maintenance. Please try again later.',
        toggled_at: new Date().toISOString(),
        toggled_by: req.user?.email
      }),
      req.user?.id
    ]);

    if (enabled) {
      await redisClient.getClient().set('system:maintenance', '1');
    } else {
      await redisClient.getClient().del('system:maintenance');
    }

    logger.warn('Maintenance mode toggled', {
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      enabled,
      previousEnabled: previousState.enabled
    });

    res.json({
      success: true,
      data: {
        maintenance_mode: enabled,
        message: maintenanceMessage || 'System under maintenance. Please try again later.',
        previous_state: previousState.enabled
      }
    });
  } catch (error) {
    logger.error('Error toggling maintenance mode:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle maintenance mode' });
  }
}
