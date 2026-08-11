import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { wsManager } from '../core/websocket';

export interface NotificationPayload {
  workspace_id?: string;
  user_id?: string;
  channel: string;
  event_type: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  priority?: number;
}

class NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    try {
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO notification_queue (workspace_id, user_id, channel, event_type, title, body, data, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`,
        [
          payload.workspace_id || null,
          payload.user_id || null,
          payload.channel,
          payload.event_type,
          payload.title,
          payload.body || null,
          JSON.stringify(payload.data || {}),
          payload.priority || 5,
        ],
      );

      const notificationId = result.rows[0].id;

      if (payload.channel === 'browser' && payload.workspace_id) {
        wsManager.broadcast(payload.workspace_id, 'notification', {
          id: notificationId,
          title: payload.title,
          body: payload.body,
          event_type: payload.event_type,
          data: payload.data,
          created_at: new Date().toISOString(),
        });
      }

      await pool.query(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [
        notificationId,
      ]);

      logger.info(`Notification sent: ${payload.channel}/${payload.event_type} -> ${payload.title}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  async broadcastToWorkspace(
    workspaceId: string,
    eventType: string,
    title: string,
    body?: string,
    data?: Record<string, any>,
  ): Promise<void> {
    await this.send({
      workspace_id: workspaceId,
      channel: 'browser',
      event_type: eventType,
      title,
      body,
      data,
    });
  }

  async notifyUser(
    userId: string,
    workspaceId: string,
    eventType: string,
    title: string,
    body?: string,
    data?: Record<string, any>,
  ): Promise<void> {
    await this.send({
      workspace_id: workspaceId,
      user_id: userId,
      channel: 'browser',
      event_type: eventType,
      title,
      body,
      data,
    });
  }

  async getNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM notification_queue
       WHERE user_id = $1 OR (workspace_id = (SELECT workspace_id FROM users WHERE id = $1) AND user_id IS NULL)
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return result.rows;
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE notification_queue SET read_at = NOW(), status = 'read' WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [notificationId, userId],
    );
  }

  async markAllRead(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE notification_queue SET read_at = NOW(), status = 'read'
       WHERE (user_id = $1 OR (workspace_id = (SELECT workspace_id FROM users WHERE id = $1) AND user_id IS NULL))
       AND read_at IS NULL`,
      [userId],
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) FROM notification_queue
       WHERE (user_id = $1 OR (workspace_id = (SELECT workspace_id FROM users WHERE id = $1) AND user_id IS NULL))
       AND read_at IS NULL`,
      [userId],
    );
    return parseInt(result.rows[0].count);
  }
}

export const notificationService = new NotificationService();
