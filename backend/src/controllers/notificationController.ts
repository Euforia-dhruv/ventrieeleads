import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const unreadOnly = req.query.unread === 'true';
    let query = 'SELECT * FROM notifications';
    if (unreadOnly) query += ' WHERE is_read = false';
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query);
    const unreadCount = await pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = false');
    res.json({
      success: true,
      data: result.rows,
      unread_count: parseInt(unreadCount.rows[0].count)
    });
  } catch (error) {
    logger.error('Error listing notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking notification:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false');
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking all:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all' });
  }
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM notifications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
}
