import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import axios from 'axios';

const ENQUEUER_URL = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';

export async function generateOutreach(req: Request, res: Response): Promise<void> {
  try {
    const { company_id, channel, channels } = req.body;

    if (!company_id) {
      res.status(400).json({ success: false, message: 'company_id is required' });
      return;
    }

    const channelList = channels || [channel || 'cold_email'];
    const results: Record<string, any> = {};

    for (const ch of channelList) {
      try {
        const response = await axios.post(`${ENQUEUER_URL}/outreach`, {
          company_id,
          channel: ch,
        }, { timeout: 60000 });
        results[ch] = response.data.data;
      } catch (err: any) {
        logger.error(`Outreach generation failed for ${ch}:`, err?.message);
        results[ch] = { error: err?.message || 'Failed' };
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error('Outreach generation failed:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to generate outreach' });
  }
}

export async function getLeadOutreachHistory(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT * FROM outreach_activities 
       WHERE lead_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get outreach history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch outreach history' });
  }
}

export async function recordOutreach(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { channel, message, status = 'draft' } = req.body;
  const pool = getPool();

  try {
    const result = await pool.query(
      `INSERT INTO outreach_activities (lead_id, channel, message, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, channel, message, status]
    );

    if (id) {
      await pool.query(
        `UPDATE leads SET last_contacted_at = NOW(), status = 'Contacted' WHERE id = $1`,
        [id]
      ).catch(() => {});
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Failed to record outreach:', error);
    res.status(500).json({ success: false, message: 'Failed to record outreach' });
  }
}
