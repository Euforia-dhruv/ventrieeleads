import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function listPresets(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM search_presets WHERE is_active = true ORDER BY sort_order ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing presets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch presets' });
  }
}

export async function createPreset(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name, slug, description, industry, city, area, country = '', query_template, icon } = req.body;
    const result = await pool.query(`
      INSERT INTO search_presets (name, slug, description, industry, city, area, country, query_template, icon)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [name, slug, description, industry, city, area, country, query_template, icon]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating preset:', error);
    res.status(500).json({ success: false, message: 'Failed to create preset' });
  }
}

export async function deletePreset(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM search_presets WHERE id = $1 AND is_builtin = false', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting preset:', error);
    res.status(500).json({ success: false, message: 'Failed to delete preset' });
  }
}
