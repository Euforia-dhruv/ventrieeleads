import { Request, Response } from 'express';
import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function listCampaigns(req: Request, res: Response): Promise<void> {
  const client = getPool().connect();
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  } finally {
    (client as any)?.release?.();
  }
}

export async function createCampaign(req: Request, res: Response): Promise<void> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'INSERT INTO campaigns (name, status, industry_filter, location_filter, lead_score_min, lead_score_max) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        req.body.name,
        req.body.status || 'active',
        JSON.stringify(req.body.industry_filter || []),
        JSON.stringify(req.body.location_filter || []),
        req.body.lead_score_min || 0,
        req.body.lead_score_max || 100
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  } finally {
    client.release();
  }
}

export async function updateCampaign(req: Request, res: Response): Promise<void> {
  const client = await getPool().connect();
  try {
    const id = parseInt(req.params.id);
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.body.name) {
      sets.push(`name = $${paramIndex}`);
      values.push(req.body.name);
      paramIndex++;
    }
    if (req.body.status) {
      sets.push(`status = $${paramIndex}`);
      values.push(req.body.status);
      paramIndex++;
    }
    if (req.body.industry_filter) {
      sets.push(`industry_filter = $${paramIndex}`);
      values.push(JSON.stringify(req.body.industry_filter));
      paramIndex++;
    }
    if (req.body.location_filter) {
      sets.push(`location_filter = $${paramIndex}`);
      values.push(JSON.stringify(req.body.location_filter));
      paramIndex++;
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  } finally {
    client.release();
  }
}

export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  const client = await getPool().connect();
  try {
    const id = parseInt(req.params.id);
    await client.query('DELETE FROM campaigns WHERE id = $1', [id]);
    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  } finally {
    client.release();
  }
}
