import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';

export async function listCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_leads cl WHERE cl.campaign_id = c.id) as lead_count
      FROM campaigns c WHERE c.is_deleted = false ORDER BY c.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
}

export async function createCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const {
      name,
      description,
      status = 'active',
      industry_filter = [],
      location_filter = [],
      lead_score_min = 0,
      lead_score_max = 100,
      notes,
    } = req.body;
    const result = await pool.query(
      `
      INSERT INTO campaigns (id, name, description, status, industry_filter, location_filter,
        lead_score_min, lead_score_max, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `,
      [
        uuidv4(),
        name,
        description,
        status,
        JSON.stringify(industry_filter),
        JSON.stringify(location_filter),
        lead_score_min,
        lead_score_max,
        notes,
      ],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
}

export async function updateCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const updates = req.body;
    const allowed = ['name', 'description', 'status', 'notes', 'lead_score_min', 'lead_score_max'];
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        values.push(updates[field]);
      }
    }
    if (updates.industry_filter) {
      sets.push(`industry_filter = $${idx++}`);
      values.push(JSON.stringify(updates.industry_filter));
    }
    if (updates.location_filter) {
      sets.push(`location_filter = $${idx++}`);
      values.push(JSON.stringify(updates.location_filter));
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }
    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${idx} AND is_deleted = false RETURNING *`,
      values,
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}

export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('UPDATE campaigns SET is_deleted = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
}

export async function addLeadToCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { lead_id, notes } = req.body;

    await pool.query(
      `
      INSERT INTO campaign_leads (id, campaign_id, lead_id, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (campaign_id, lead_id) DO NOTHING
    `,
      [uuidv4(), id, lead_id, notes || null],
    );

    res.status(201).json({ success: true, message: 'Lead added to campaign' });
  } catch (error) {
    logger.error('Error adding lead to campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to add lead' });
  }
}

export async function removeLeadFromCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id, leadId } = req.params;
    await pool.query('DELETE FROM campaign_leads WHERE campaign_id = $1 AND lead_id = $2', [id, leadId]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing lead from campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to remove lead' });
  }
}

export async function getCampaignLeads(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT cl.*, l.score, l.score_label, l.status as lead_status,
             c.name as company_name, c.website, c.industry, c.city
      FROM campaign_leads cl
      JOIN leads l ON cl.lead_id = l.id
      JOIN companies c ON l.company_id = c.id
      WHERE cl.campaign_id = $1
      ORDER BY cl.added_at DESC
    `,
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching campaign leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaign leads' });
  }
}
