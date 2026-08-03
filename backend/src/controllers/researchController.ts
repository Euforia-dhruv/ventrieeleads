import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export const getProviderList = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, slug, name, description, provider_type, config, is_enabled, priority, success_rate, total_results
       FROM provider_configs
       WHERE is_enabled = true AND is_deleted = false
       ORDER BY priority DESC, name ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get providers', error);
    res.status(500).json({ success: false, message: 'Failed to get providers' });
  }
};

export const triggerResearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id }),
    });
    const result: any = await response.json();
    res.json({ success: true, data: { task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to start research', error);
    res.status(500).json({ success: false, message: 'Failed to start research' });
  }
};

export const getResearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM company_research
       WHERE company_id = $1 AND is_deleted = false
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Failed to get research', error);
    res.status(500).json({ success: false, message: 'Failed to get research' });
  }
};

export const triggerCompetitorAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/competitor-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id }),
    });
    const result: any = await response.json();
    res.json({ success: true, data: { task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to start competitor analysis', error);
    res.status(500).json({ success: false, message: 'Failed to start competitor analysis' });
  }
};

export const getCompetitorAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM competitor_analyses
       WHERE company_id = $1 AND is_deleted = false
       ORDER BY created_at DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get competitor analyses', error);
    res.status(500).json({ success: false, message: 'Failed to get competitor analyses' });
  }
};
