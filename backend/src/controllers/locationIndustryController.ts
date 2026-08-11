import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import axios from 'axios';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

async function forwardGeocode(query: string, limit: number): Promise<any[]> {
  try {
    const resp = await axios.get(NOMINATIM_SEARCH_URL, {
      params: { q: query, format: 'jsonv2', limit, addressdetails: 1 },
      headers: { 'User-Agent': 'leads-platform/1.0 (lead-discovery)' },
      timeout: 6000,
    });
    if (resp.status !== 200 || !Array.isArray(resp.data)) return [];

    return resp.data.map((item: any) => {
      const addr = item.address || {};
      return {
        name: item.name || '',
        display_name: item.display_name || '',
        latitude: parseFloat(item.lat) || null,
        longitude: parseFloat(item.lon) || null,
        country_code: (addr.country_code || '').toUpperCase(),
        country_name: addr.country || '',
        location_type: item.type || 'city',
        source: 'nominatim',
      };
    });
  } catch (error) {
    logger.debug('Nominatim forward geocode failed:', error);
    return [];
  }
}

// ── LOCATIONS ──────────────────────────────────────────────────────────────────

export async function searchLocations(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (q.length < 2) {
      res.json({ locations: [] });
      return;
    }

    const result = await pool.query(
      `
      SELECT id, name, slug, location_type, parent_id, country_code,
             latitude, longitude, timezone, population
      FROM locations
      WHERE is_deleted = false AND is_active = true
        AND name ILIKE $1
      ORDER BY
        CASE location_type
          WHEN 'city' THEN 1
          WHEN 'state' THEN 2
          WHEN 'country' THEN 3
          ELSE 4
        END,
        population DESC NULLS LAST,
        name ASC
      LIMIT $2
    `,
      [`%${q}%`, limit],
    );

    const rows = result.rows;

    // Fallback: when the seeded DB has no match, use OSM forward geocoding so
    // arbitrary worldwide place names still resolve to coordinates.
    if (rows.length === 0) {
      const geocoded = await forwardGeocode(q, limit);
      if (geocoded.length > 0) {
        res.json({ locations: geocoded, fallback: 'nominatim' });
        return;
      }
    }

    res.json({ locations: rows });
  } catch (error) {
    logger.error('Error searching locations:', error);
    res.status(500).json({ locations: [] });
  }
}

export async function listLocations(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { type, parent_id, country_code, search, depth } = req.query;

    let query = 'SELECT * FROM locations WHERE is_deleted = false';
    const params: any[] = [];
    let idx = 1;

    if (type) {
      query += ` AND location_type = $${idx++}`;
      params.push(type);
    }
    if (parent_id) {
      query += ` AND parent_id = $${idx++}`;
      params.push(parent_id);
    }
    if (country_code) {
      query += ` AND UPPER(country_code) = UPPER(${idx++})`;
      params.push(country_code);
    }
    if (search) {
      query += ` AND name ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name ASC';

    if (depth) {
      const limit = parseInt(depth as string, 10) || 50;
      query += ` LIMIT $${idx++}`;
      params.push(limit);
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing locations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch locations' });
  }
}

export async function getLocationTree(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { country_code, max_depth } = req.query;
    const maxD = parseInt(max_depth as string, 10) || 3;

    let query = 'SELECT * FROM locations WHERE is_deleted = false AND is_active = true';
    const params: any[] = [];
    let idx = 1;

    if (country_code) {
      query += ` AND UPPER(country_code) = UPPER(${idx++})`;
      params.push(country_code);
    }
    query += ' ORDER BY location_type, name ASC';

    const result = await pool.query(query, params);

    const buildTree = (parentId: string | null, depth: number): any[] => {
      if (depth >= maxD) return [];
      return result.rows
        .filter((r: any) => (r.parent_id || null) === parentId)
        .map((r: any) => ({
          ...r,
          children: buildTree(r.id, depth + 1),
        }));
    };

    const tree = buildTree(null, 0);
    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error('Error building location tree:', error);
    res.status(500).json({ success: false, message: 'Failed to build location tree' });
  }
}

export async function createLocation(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, gdp_usd } =
      req.body;

    if (!name || !slug || !location_type) {
      res.status(400).json({ success: false, message: 'name, slug, and location_type are required' });
      return;
    }

    const result = await pool.query(
      `
      INSERT INTO locations (name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, gdp_usd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
      [
        name,
        slug,
        location_type,
        parent_id || null,
        country_code || null,
        latitude || null,
        longitude || null,
        timezone || null,
        population || null,
        gdp_usd || null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, message: 'Location slug already exists under this parent' });
    } else {
      logger.error('Error creating location:', error);
      res.status(500).json({ success: false, message: 'Failed to create location' });
    }
  }
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, slug, latitude, longitude, timezone, population, gdp_usd, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE locations SET
        name = COALESCE($1, name), slug = COALESCE($2, slug),
        latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude),
        timezone = COALESCE($5, timezone), population = COALESCE($6, population),
        gdp_usd = COALESCE($7, gdp_usd), is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9 AND is_deleted = false RETURNING *
    `,
      [name, slug, latitude, longitude, timezone, population, gdp_usd, is_active, id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Location not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating location:', error);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
}

export async function deleteLocation(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE locations SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Location not found' });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('Error deleting location:', error);
    res.status(500).json({ success: false, message: 'Failed to delete location' });
  }
}

export async function getLocationsByCountry(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { countryCode } = req.params;

    const states = await pool.query(
      'SELECT * FROM locations WHERE UPPER(country_code) = UPPER($1) AND location_type = $2 AND is_deleted = false ORDER BY name',
      [countryCode, 'state'],
    );

    const cities = await pool.query(
      'SELECT * FROM locations WHERE UPPER(country_code) = UPPER($1) AND location_type = $2 AND is_deleted = false ORDER BY name',
      [countryCode, 'city'],
    );

    res.json({
      success: true,
      data: {
        states: states.rows,
        cities: cities.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching locations by country:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch locations' });
  }
}

// ── INDUSTRIES ─────────────────────────────────────────────────────────────────

export async function listIndustries(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { parent_id, search } = req.query;

    let query = 'SELECT * FROM industries WHERE is_deleted = false';
    const params: any[] = [];
    let idx = 1;

    if (parent_id) {
      query += ` AND parent_id = $${idx++}`;
      params.push(parent_id);
    }
    if (search) {
      query += ` AND name ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY sort_order ASC, name ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing industries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch industries' });
  }
}

export async function getIndustryTree(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { max_depth } = req.query;
    const maxD = parseInt(max_depth as string, 10) || 3;

    const result = await pool.query(
      'SELECT * FROM industries WHERE is_deleted = false AND is_active = true ORDER BY sort_order, name',
    );

    const buildTree = (parentId: string | null, depth: number): any[] => {
      if (depth >= maxD) return [];
      return result.rows
        .filter((r: any) => (r.parent_id || null) === parentId)
        .map((r: any) => ({
          ...r,
          children: buildTree(r.id, depth + 1),
        }));
    };

    const tree = buildTree(null, 0);
    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error('Error building industry tree:', error);
    res.status(500).json({ success: false, message: 'Failed to build industry tree' });
  }
}

export async function createIndustry(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name, slug, parent_id, icon, sort_order } = req.body;

    if (!name || !slug) {
      res.status(400).json({ success: false, message: 'name and slug are required' });
      return;
    }

    const result = await pool.query(
      `
      INSERT INTO industries (name, slug, parent_id, icon, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [name, slug, parent_id || null, icon || null, sort_order || 0],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, message: 'Industry slug already exists under this parent' });
    } else {
      logger.error('Error creating industry:', error);
      res.status(500).json({ success: false, message: 'Failed to create industry' });
    }
  }
}

export async function updateIndustry(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, slug, icon, sort_order, is_active } = req.body;

    const result = await pool.query(
      `
      UPDATE industries SET
        name = COALESCE($1, name), slug = COALESCE($2, slug),
        icon = COALESCE($3, icon), sort_order = COALESCE($4, sort_order),
        is_active = COALESCE($5, is_active), updated_at = NOW()
      WHERE id = $6 AND is_deleted = false RETURNING *
    `,
      [name, slug, icon, sort_order, is_active, id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Industry not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating industry:', error);
    res.status(500).json({ success: false, message: 'Failed to update industry' });
  }
}

export async function deleteIndustry(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE industries SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Industry not found' });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('Error deleting industry:', error);
    res.status(500).json({ success: false, message: 'Failed to delete industry' });
  }
}
