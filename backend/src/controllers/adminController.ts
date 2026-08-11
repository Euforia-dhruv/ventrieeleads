import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function listSettings(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM admin_settings ORDER BY category, key');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
}

export async function updateSetting(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { key } = req.params;
    const { value, description } = req.body;
    const result = await pool.query(
      `
      INSERT INTO admin_settings (key, value, description, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, description = COALESCE($3, admin_settings.description), updated_at = NOW()
      RETURNING *
    `,
      [key, JSON.stringify(value), description || null],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating setting:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
}

export async function getWorkerStatus(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const runningJobs = await pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'running'");
    const queuedJobs = await pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'queued'");
    const completedToday = await pool.query(
      "SELECT COUNT(*) FROM search_jobs WHERE status = 'completed' AND completed_at >= CURRENT_DATE",
    );
    const failedToday = await pool.query(
      "SELECT COUNT(*) FROM search_jobs WHERE status = 'failed' AND updated_at >= CURRENT_DATE",
    );

    res.json({
      success: true,
      data: {
        workers: { search: 'ready', scrape: 'ready', audit: 'ready', process: 'ready' },
        queues: {
          running: parseInt(runningJobs.rows[0].count),
          queued: parseInt(queuedJobs.rows[0].count),
          completed_today: parseInt(completedToday.rows[0].count),
          failed_today: parseInt(failedToday.rows[0].count),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching worker status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch worker status' });
  }
}
