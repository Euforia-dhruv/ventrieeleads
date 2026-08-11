import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export const getMonitoringSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM monitoring_schedules
       WHERE company_id = $1 AND is_deleted = false
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Failed to get monitoring schedule', error);
    res.status(500).json({ success: false, message: 'Failed to get monitoring schedule' });
  }
};

export const updateMonitoringSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/monitoring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id, ...req.body }),
    });
    const result: any = await response.json();
    res.json({ success: true, data: { task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to update monitoring', error);
    res.status(500).json({ success: false, message: 'Failed to update monitoring' });
  }
};

export const triggerMonitoringCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/monitoring/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id }),
    });
    const result: any = await response.json();
    res.json({ success: true, data: { task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to start monitoring check', error);
    res.status(500).json({ success: false, message: 'Failed to start monitoring check' });
  }
};

export const getMonitoringHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM monitoring_snapshots
       WHERE company_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get monitoring history', error);
    res.status(500).json({ success: false, message: 'Failed to get monitoring history' });
  }
};
