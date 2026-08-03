import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { redisClient } from '../database/redis';

// ── Types ───────────────────────────────────────────────────
export type AuditEventCategory = 'auth' | 'data_access' | 'admin' | 'system' | 'security' | 'data_change';

export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'token_refresh'
  | 'session_revoked'
  | 'email_verified'
  | 'magic_link_requested'
  | 'magic_link_used'
  | 'oauth_login'
  | 'read'
  | 'read_list'
  | 'export'
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_delete'
  | 'role_change'
  | 'permission_change'
  | 'settings_change'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_disabled'
  | 'user_enabled'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'workspace_created'
  | 'workspace_updated'
  | 'backup_triggered'
  | 'system_error'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'unauthorized_access_attempt'
  | 'data_export'
  | 'data_import'
  | 'search_performed'
  | 'ai_request'
  | 'agent_run'
  | 'campaign_activated'
  | 'campaign_paused';

export interface AuditLogEntry {
  id?: string;
  workspace_id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  category: AuditEventCategory;
  event_type: AuditEventType;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  action: string;
  description?: string;
  changes?: Record<string, { before: any; after: any }>;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  trace_id?: string;
  status: 'success' | 'failure' | 'error';
  duration_ms?: number;
  created_at?: Date;
}

export interface AuditLogFilters {
  workspace_id?: string;
  user_id?: string;
  category?: AuditEventCategory;
  event_type?: AuditEventType;
  resource_type?: string;
  resource_id?: string;
  status?: 'success' | 'failure' | 'error';
  start_date?: Date;
  end_date?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'category' | 'event_type';
  order_direction?: 'asc' | 'desc';
}

// ── Core Audit Service ──────────────────────────────────────
class AuditLogService {
  private readonly REDIS_KEY_PREFIX = 'audit:';
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly BATCH_SIZE = 100;
  private pendingLogs: AuditLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startBatchFlush();
  }

  private startBatchFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.pendingLogs.length > 0) {
        this.flushBatch();
      }
    }, 5000);
  }

  stopBatchFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const batch = this.pendingLogs.splice(0, this.BATCH_SIZE);
    try {
      const pool = getPool();
      const values: any[][] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        const idx = i * 17 + 1;
        placeholders.push(
          `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15}, $${idx + 16})`
        );
        values.push([
          entry.workspace_id,
          entry.user_id || null,
          entry.user_email || null,
          entry.user_name || null,
          entry.category,
          entry.event_type,
          entry.resource_type || null,
          entry.resource_id || null,
          entry.resource_name || null,
          entry.action,
          entry.description || null,
          entry.changes ? JSON.stringify(entry.changes) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.ip_address || null,
          entry.user_agent || null,
          entry.request_id || null,
          entry.status
        ]);
      }

      const query = `
        INSERT INTO audit_logs (workspace_id, user_id, user_email, user_name, category, event_type,
          resource_type, resource_id, resource_name, action, description, changes, metadata,
          ip_address, user_agent, request_id, status)
        VALUES ${placeholders.join(', ')}
      `;

      await pool.query(query, values.flat());

      for (const entry of batch) {
        this.cacheLog(entry);
      }

      logger.debug(`Flushed ${batch.length} audit log entries`);
    } catch (error) {
      logger.error('Failed to flush audit logs:', error);
      this.pendingLogs.unshift(...batch);
    }
  }

  private async cacheLog(entry: AuditLogEntry): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `${this.REDIS_KEY_PREFIX}${entry.workspace_id}:${entry.event_type}`;
      await client.setEx(key, this.CACHE_TTL, JSON.stringify({
        ...entry,
        cached_at: new Date().toISOString()
      }));
    } catch {
      // Redis optional
    }
  }

  private async writeLog(entry: AuditLogEntry): Promise<void> {
    entry.created_at = new Date();
    this.pendingLogs.push(entry);

    if (this.pendingLogs.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }
  }

  private extractRequestInfo(req?: any): { ip_address?: string; user_agent?: string; request_id?: string; trace_id?: string } {
    if (!req) return {};
    return {
      ip_address: req.ip || req.socket?.remoteAddress,
      user_agent: req.headers?.['user-agent'],
      request_id: req.headers?.['x-request-id'],
      trace_id: (req as any)?.traceId
    };
  }

  private extractUserInfo(req?: any): { user_id?: string; user_email?: string; user_name?: string; workspace_id?: string } {
    if (!req?.user) return {};
    return {
      user_id: req.user.id,
      user_email: req.user.email,
      user_name: req.user.name,
      workspace_id: req.user.workspace_id || req.workspaceId
    };
  }

  // ── Auth Events ──────────────────────────────────────────
  async logAuthEvent(
    eventType: AuditEventType,
    req?: any,
    details?: {
      workspace_id?: string;
      resource_type?: string;
      resource_id?: string;
      description?: string;
      metadata?: Record<string, any>;
      status?: 'success' | 'failure' | 'error';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details?.workspace_id || req?.user?.workspace_id || req?.workspaceId || 'system',
      category: 'auth',
      event_type: eventType,
      resource_type: details?.resource_type || 'user',
      resource_id: details?.resource_id || req?.user?.id,
      action: this.eventTypeToAction(eventType),
      description: details?.description,
      metadata: details?.metadata,
      status: details?.status || 'success',
      ...this.extractRequestInfo(req),
      ...this.extractUserInfo(req)
    };

    await this.writeLog(entry);

    logger.info('Auth event logged', {
      event_type: eventType,
      user_id: entry.user_id,
      status: entry.status,
      ip: entry.ip_address
    });
  }

  // ── Data Access Events ──────────────────────────────────
  async logDataAccess(
    eventType: AuditEventType,
    req?: any,
    details?: {
      workspace_id?: string;
      resource_type: string;
      resource_id?: string;
      resource_name?: string;
      description?: string;
      metadata?: Record<string, any>;
      status?: 'success' | 'failure' | 'error';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details?.workspace_id || req?.user?.workspace_id || req?.workspaceId || 'system',
      category: 'data_access',
      event_type: eventType,
      resource_type: details?.resource_type,
      resource_id: details?.resource_id,
      resource_name: details?.resource_name,
      action: this.eventTypeToAction(eventType),
      description: details?.description,
      metadata: details?.metadata,
      status: details?.status || 'success',
      ...this.extractRequestInfo(req),
      ...this.extractUserInfo(req)
    };

    await this.writeLog(entry);
  }

  // ── Admin Events ────────────────────────────────────────
  async logAdminAction(
    eventType: AuditEventType,
    req?: any,
    details?: {
      workspace_id?: string;
      resource_type: string;
      resource_id?: string;
      resource_name?: string;
      description?: string;
      changes?: Record<string, { before: any; after: any }>;
      metadata?: Record<string, any>;
      status?: 'success' | 'failure' | 'error';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details?.workspace_id || req?.user?.workspace_id || req?.workspaceId || 'system',
      category: 'admin',
      event_type: eventType,
      resource_type: details?.resource_type,
      resource_id: details?.resource_id,
      resource_name: details?.resource_name,
      action: this.eventTypeToAction(eventType),
      description: details?.description,
      changes: details?.changes,
      metadata: details?.metadata,
      status: details?.status || 'success',
      ...this.extractRequestInfo(req),
      ...this.extractUserInfo(req)
    };

    await this.writeLog(entry);

    logger.warn('Admin action logged', {
      event_type: eventType,
      user_id: entry.user_id,
      resource: `${details?.resource_type}:${details?.resource_id}`,
      changes: details?.changes ? Object.keys(details.changes) : undefined,
      ip: entry.ip_address
    });
  }

  // ── Data Change Events ──────────────────────────────────
  async logDataChange(
    eventType: AuditEventType,
    req?: any,
    details?: {
      workspace_id?: string;
      resource_type: string;
      resource_id?: string;
      resource_name?: string;
      description?: string;
      changes?: Record<string, { before: any; after: any }>;
      metadata?: Record<string, any>;
      status?: 'success' | 'failure' | 'error';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details?.workspace_id || req?.user?.workspace_id || req?.workspaceId || 'system',
      category: 'data_change',
      event_type: eventType,
      resource_type: details?.resource_type,
      resource_id: details?.resource_id,
      resource_name: details?.resource_name,
      action: this.eventTypeToAction(eventType),
      description: details?.description,
      changes: details?.changes,
      metadata: details?.metadata,
      status: details?.status || 'success',
      ...this.extractRequestInfo(req),
      ...this.extractUserInfo(req)
    };

    await this.writeLog(entry);
  }

  // ── System Events ───────────────────────────────────────
  async logSystemEvent(
    eventType: AuditEventType,
    details: {
      workspace_id?: string;
      resource_type?: string;
      resource_id?: string;
      description: string;
      metadata?: Record<string, any>;
      status?: 'success' | 'failure' | 'error';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details.workspace_id || 'system',
      category: 'system',
      event_type: eventType,
      resource_type: details.resource_type,
      resource_id: details.resource_id,
      action: this.eventTypeToAction(eventType),
      description: details.description,
      metadata: details.metadata,
      status: details.status || 'success'
    };

    await this.writeLog(entry);
  }

  // ── Security Events ─────────────────────────────────────
  async logSecurityEvent(
    eventType: AuditEventType,
    req?: any,
    details?: {
      workspace_id?: string;
      resource_type?: string;
      resource_id?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      workspace_id: details?.workspace_id || req?.user?.workspace_id || req?.workspaceId || 'system',
      category: 'security',
      event_type: eventType,
      resource_type: details?.resource_type || 'system',
      resource_id: details?.resource_id,
      action: this.eventTypeToAction(eventType),
      description: details?.description,
      metadata: details?.metadata,
      status: 'failure',
      ...this.extractRequestInfo(req),
      ...this.extractUserInfo(req)
    };

    await this.writeLog(entry);

    logger.warn('Security event logged', {
      event_type: eventType,
      ip: entry.ip_address,
      user_agent: entry.user_agent,
      description: entry.description
    });
  }

  // ── Get Audit Logs ──────────────────────────────────────
  async getAuditLogs(filters: AuditLogFilters): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const pool = getPool();
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (filters.workspace_id) {
      const clause = ` AND workspace_id = $${paramIndex}`;
      query += clause;
      countQuery += ` AND workspace_id = $${countParamIndex}`;
      params.push(filters.workspace_id);
      countParams.push(filters.workspace_id);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.user_id) {
      const clause = ` AND user_id = $${paramIndex}`;
      query += clause;
      countQuery += ` AND user_id = $${countParamIndex}`;
      params.push(filters.user_id);
      countParams.push(filters.user_id);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.category) {
      const clause = ` AND category = $${paramIndex}`;
      query += clause;
      countQuery += ` AND category = $${countParamIndex}`;
      params.push(filters.category);
      countParams.push(filters.category);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.event_type) {
      const clause = ` AND event_type = $${paramIndex}`;
      query += clause;
      countQuery += ` AND event_type = $${countParamIndex}`;
      params.push(filters.event_type);
      countParams.push(filters.event_type);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.resource_type) {
      const clause = ` AND resource_type = $${paramIndex}`;
      query += clause;
      countQuery += ` AND resource_type = $${countParamIndex}`;
      params.push(filters.resource_type);
      countParams.push(filters.resource_type);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.resource_id) {
      const clause = ` AND resource_id = $${paramIndex}`;
      query += clause;
      countQuery += ` AND resource_id = $${countParamIndex}`;
      params.push(filters.resource_id);
      countParams.push(filters.resource_id);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.status) {
      const clause = ` AND status = $${paramIndex}`;
      query += clause;
      countQuery += ` AND status = $${countParamIndex}`;
      params.push(filters.status);
      countParams.push(filters.status);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.start_date) {
      const clause = ` AND created_at >= $${paramIndex}`;
      query += clause;
      countQuery += ` AND created_at >= $${countParamIndex}`;
      params.push(filters.start_date);
      countParams.push(filters.start_date);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.end_date) {
      const clause = ` AND created_at <= $${paramIndex}`;
      query += clause;
      countQuery += ` AND created_at <= $${countParamIndex}`;
      params.push(filters.end_date);
      countParams.push(filters.end_date);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.search) {
      const searchClause = ` AND (description ILIKE $${paramIndex} OR user_email ILIKE $${paramIndex} OR resource_name ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`;
      query += searchClause;
      countQuery += searchClause;
      params.push(`%${filters.search}%`);
      countParams.push(`%${filters.search}%`);
      paramIndex++;
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const validSortColumns: Record<string, string> = {
      created_at: 'created_at',
      category: 'category',
      event_type: 'event_type'
    };
    const sortColumn = validSortColumns[filters.order_by || 'created_at'] || 'created_at';
    const sortDirection = filters.order_direction === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const logs = result.rows.map((row: any) => ({
      ...row,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return {
      logs,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  // ── Helpers ──────────────────────────────────────────────
  private eventTypeToAction(eventType: AuditEventType): string {
    const actionMap: Record<string, string> = {
      login_success: 'Login',
      login_failed: 'Failed login attempt',
      logout: 'Logout',
      register: 'Register',
      password_change: 'Password change',
      password_reset_request: 'Password reset request',
      password_reset_complete: 'Password reset complete',
      token_refresh: 'Token refresh',
      session_revoked: 'Session revoked',
      email_verified: 'Email verified',
      magic_link_requested: 'Magic link requested',
      magic_link_used: 'Magic link used',
      oauth_login: 'OAuth login',
      read: 'Read',
      read_list: 'List',
      export: 'Export',
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      bulk_create: 'Bulk create',
      bulk_update: 'Bulk update',
      bulk_delete: 'Bulk delete',
      role_change: 'Role change',
      permission_change: 'Permission change',
      settings_change: 'Settings change',
      user_created: 'User created',
      user_updated: 'User updated',
      user_deleted: 'User deleted',
      user_disabled: 'User disabled',
      user_enabled: 'User enabled',
      api_key_created: 'API key created',
      api_key_revoked: 'API key revoked',
      workspace_created: 'Workspace created',
      workspace_updated: 'Workspace updated',
      backup_triggered: 'Backup triggered',
      system_error: 'System error',
      rate_limit_exceeded: 'Rate limit exceeded',
      suspicious_activity: 'Suspicious activity',
      unauthorized_access_attempt: 'Unauthorized access attempt',
      data_export: 'Data export',
      data_import: 'Data import',
      search_performed: 'Search performed',
      ai_request: 'AI request',
      agent_run: 'Agent run',
      campaign_activated: 'Campaign activated',
      campaign_paused: 'Campaign paused'
    };

    return actionMap[eventType] || eventType;
  }

  async flush(): Promise<void> {
    await this.flushBatch();
  }

  async getStats(workspaceId: string): Promise<Record<string, any>> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT category, event_type, status, COUNT(*) as count,
             MIN(created_at) as earliest, MAX(created_at) as latest
      FROM audit_logs
      WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY category, event_type, status
      ORDER BY count DESC
    `, [workspaceId]);

    const failedResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE workspace_id = $1 AND status = 'failure' AND created_at > NOW() - INTERVAL '24 hours'
    `, [workspaceId]);

    const uniqueUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM audit_logs
      WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
    `, [workspaceId]);

    return {
      events: result.rows,
      failedCount: parseInt(failedResult.rows[0].count),
      uniqueUsers: parseInt(uniqueUsers.rows[0].count),
      totalEvents: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0)
    };
  }
}

export const auditLogService = new AuditLogService();
