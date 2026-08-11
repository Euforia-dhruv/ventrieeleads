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
       ORDER BY priority DESC, name ASC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get providers', error);
    res.status(500).json({ success: false, message: 'Failed to get providers' });
  }
};

export const getCompanyDiscoveryConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();

    const [industriesResult, locationsResult, providersResult] = await Promise.all([
      pool.query(
        `SELECT id, name, slug FROM industries
         WHERE is_deleted = false AND is_active = true
         ORDER BY sort_order ASC, name ASC`,
      ),
      pool.query(
        `SELECT id, name, slug, location_type, parent_id, country_code
         FROM locations
         WHERE is_deleted = false AND is_active = true
         ORDER BY
           CASE location_type
             WHEN 'country' THEN 1
             WHEN 'state' THEN 2
             WHEN 'city' THEN 3
             ELSE 4
           END,
           name ASC`,
      ),
      pool.query(
        `SELECT id, slug, name FROM provider_configs
         WHERE is_enabled = true AND is_deleted = false
         ORDER BY priority DESC, name ASC`,
      ),
    ]);

    const locationsByCountry = locationsResult.rows.reduce<
      Record<string, { country: string; countryCode: string; areas: string[] }>
    >((acc, loc) => {
      if (loc.location_type === 'country') return acc;
      const key = loc.country_code || 'OTHER';
      const entry = (acc[key] ||= { country: loc.country_code, countryCode: loc.country_code, areas: [] });
      entry.areas.push(loc.name);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        sources: providersResult.rows.length
          ? providersResult.rows.map((p) => p.name)
          : ['Google Maps', 'Clutch', 'GoodFirms', 'DesignRush'],
        availableIndustries: industriesResult.rows.length ? industriesResult.rows.map((i) => i.name) : [],
        availableLocations: locationsByCountry,
      },
    });
  } catch (error) {
    logger.error('Failed to get company discovery config', error);
    res.status(500).json({ success: false, message: 'Failed to get company discovery config' });
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
      [id],
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
    const response = await fetch(
      `${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/competitor-analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id }),
      },
    );
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
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to get competitor analyses', error);
    res.status(500).json({ success: false, message: 'Failed to get competitor analyses' });
  }
};
