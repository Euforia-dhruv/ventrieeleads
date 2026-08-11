import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export const listReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM reports
       WHERE is_deleted = false
       ORDER BY created_at DESC LIMIT 100`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to list reports', error);
    res.status(500).json({ success: false, message: 'Failed to list reports' });
  }
};

export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { report_type, period_start, period_end, filters } = req.body;
    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type, period_start, period_end, filters }),
    });
    const result: any = await response.json();
    res.json({ success: true, data: { task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to start report generation', error);
    res.status(500).json({ success: false, message: 'Failed to start report generation' });
  }
};

export const getReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM reports WHERE id = $1 AND is_deleted = false`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Failed to get report', error);
    res.status(500).json({ success: false, message: 'Failed to get report' });
  }
};
