import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export async function listDiscoveryCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let where = 'WHERE is_deleted = FALSE';
    const params: any[] = [];
    let idx = 1;

    if (status) {
      where += ` AND status = $${idx++}`;
      params.push(status);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM discovery_campaigns ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM discovery_campaigns ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Error listing discovery campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to list campaigns' });
  }
}

export async function getDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM discovery_campaigns WHERE id = $1 AND is_deleted = FALSE', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting discovery campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to get campaign' });
  }
}

export async function createDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const {
      name,
      description = '',
      country_ids = [],
      state_ids = [],
      city_ids = [],
      industry_ids = [],
      provider_slugs = [],
      priority = 5,
      max_businesses_per_city = 50,
      max_total_businesses = 10000,
      concurrency = 5,
      schedule_type = 'once',
      cron_expression = null,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    const id = uuidv4();
    const result = await pool.query(
      `
      INSERT INTO discovery_campaigns (
        id, name, description, status,
        country_ids, state_ids, city_ids, industry_ids, provider_slugs,
        priority, max_businesses_per_city, max_total_businesses, concurrency,
        schedule_type, cron_expression
      ) VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
      [
        id,
        name,
        description,
        JSON.stringify(country_ids),
        JSON.stringify(state_ids),
        JSON.stringify(city_ids),
        JSON.stringify(industry_ids),
        JSON.stringify(provider_slugs),
        priority,
        max_businesses_per_city,
        max_total_businesses,
        concurrency,
        schedule_type,
        cron_expression,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating discovery campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
}

export async function updateDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const fields = [
      'name',
      'description',
      'country_ids',
      'state_ids',
      'city_ids',
      'industry_ids',
      'provider_slugs',
      'priority',
      'max_businesses_per_city',
      'max_total_businesses',
      'concurrency',
      'schedule_type',
      'cron_expression',
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const val = Array.isArray(req.body[field]) ? JSON.stringify(req.body[field]) : req.body[field];
        updates.push(`${field} = $${idx++}`);
        values.push(val);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE discovery_campaigns SET ${updates.join(', ')} WHERE id = $${idx} AND is_deleted = FALSE RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating discovery campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
}

export async function deleteDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE discovery_campaigns SET is_deleted = TRUE, updated_at = NOW()
       WHERE id = $1 AND is_deleted = FALSE RETURNING id`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (error) {
    logger.error('Error deleting discovery campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
}

export async function activateDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(`SELECT * FROM discovery_campaigns WHERE id = $1 AND is_deleted = FALSE`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    try {
      await axios.post(`${enqueuerUrl}/enqueue`, {
        task: 'worker.tasks.campaign_orchestrator.execute_campaign',
        args: [id],
        kwargs: {},
        queue: 'search',
      });
      logger.info(`Campaign ${id} activation dispatched`);
    } catch (err) {
      logger.warn(`Could not enqueue campaign task: ${err}`);
    }

    res.json({ success: true, data: { message: 'Campaign activation dispatched', id } });
  } catch (error) {
    logger.error('Error activating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to activate campaign' });
  }
}

export async function pauseDiscoveryCampaign(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE discovery_campaigns SET status = 'paused', updated_at = NOW()
       WHERE id = $1 AND status = 'active' AND is_deleted = FALSE RETURNING *`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found or not active' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error pausing campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to pause campaign' });
  }
}

export async function getCampaignJobs(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let where = 'WHERE cj.campaign_id = $1 AND cj.is_deleted = FALSE';
    const params: any[] = [id];
    let idx = 2;

    if (status) {
      where += ` AND cj.status = $${idx++}`;
      params.push(status);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM campaign_jobs cj ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT cj.*, l.name as location_name, i.name as industry_name_detail
       FROM campaign_jobs cj
       LEFT JOIN locations l ON cj.location_id = l.id
       LEFT JOIN industries i ON cj.industry_id = i.id
       ${where}
       ORDER BY cj.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Error getting campaign jobs:', error);
    res.status(500).json({ success: false, message: 'Failed to get campaign jobs' });
  }
}

export async function retryCampaignJobs(req: Request, res: Response): Promise<void> {
  try {
    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    try {
      await axios.post(`${enqueuerUrl}/enqueue`, {
        task: 'worker.tasks.campaign_orchestrator.retry_failed_jobs',
        args: [req.params.id],
        kwargs: {},
        queue: 'search',
      });
    } catch (err) {
      logger.warn(`Could not enqueue retry task: ${err}`);
    }
    res.json({ success: true, data: { message: 'Retry dispatched' } });
  } catch (error) {
    logger.error('Error retrying campaign jobs:', error);
    res.status(500).json({ success: false, message: 'Failed to retry jobs' });
  }
}

export async function getCoverageStats(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const [totalCountries, totalStates, totalCities, totalIndustries, totalCompanies] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM locations WHERE location_type='country' AND is_deleted=FALSE AND is_active=TRUE`,
      ),
      pool.query(`SELECT COUNT(*) FROM locations WHERE location_type='state' AND is_deleted=FALSE AND is_active=TRUE`),
      pool.query(`SELECT COUNT(*) FROM locations WHERE location_type='city' AND is_deleted=FALSE AND is_active=TRUE`),
      pool.query(`SELECT COUNT(*) FROM industries WHERE is_deleted=FALSE AND is_active=TRUE`),
      pool.query(`SELECT COUNT(*) FROM companies WHERE is_deleted=FALSE`),
    ]);

    const coveredLocations = await pool.query(
      `SELECT COUNT(DISTINCT location_id) FROM campaign_jobs WHERE status='completed' AND is_deleted=FALSE AND location_id IS NOT NULL`,
    );
    const coveredIndustries = await pool.query(
      `SELECT COUNT(DISTINCT industry_id) FROM campaign_jobs WHERE status='completed' AND is_deleted=FALSE AND industry_id IS NOT NULL`,
    );
    const countriesWithCoverage = await pool.query(
      `SELECT COUNT(DISTINCT l.id) FROM locations l
       JOIN campaign_jobs cj ON cj.location_id = l.id
       WHERE l.location_type='country' AND cj.status='completed' AND cj.is_deleted=FALSE`,
    );

    const tc = parseInt(totalCountries.rows[0].count);
    const ts = parseInt(totalStates.rows[0].count);
    const tci = parseInt(totalCities.rows[0].count);
    const ti = parseInt(totalIndustries.rows[0].count);
    const cl = parseInt(coveredLocations.rows[0].count);
    const ci = parseInt(coveredIndustries.rows[0].count);
    const cc = parseInt(countriesWithCoverage.rows[0].count);

    res.json({
      success: true,
      data: {
        total_countries: tc,
        total_states: ts,
        total_cities: tci,
        total_industries: ti,
        total_companies: parseInt(totalCompanies.rows[0].count),
        covered_locations: cl,
        covered_industries: ci,
        countries_with_coverage: cc,
        location_coverage_pct: Math.round((cl / Math.max(tci, 1)) * 100 * 10) / 10,
        industry_coverage_pct: Math.round((ci / Math.max(ti, 1)) * 100 * 10) / 10,
        country_coverage_pct: Math.round((cc / Math.max(tc, 1)) * 100 * 10) / 10,
      },
    });
  } catch (error) {
    logger.error('Error getting coverage stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get coverage stats' });
  }
}

export async function getCountryCoverage(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        l.country_code,
        l.name as country_name,
        (SELECT COUNT(*) FROM locations sub WHERE sub.country_code = l.country_code AND sub.location_type='state' AND sub.is_deleted=FALSE) as total_states,
        (SELECT COUNT(*) FROM locations sub WHERE sub.country_code = l.country_code AND sub.location_type='city' AND sub.is_deleted=FALSE) as total_cities,
        (SELECT COUNT(*) FROM campaign_jobs cj WHERE cj.country_code = l.country_code AND cj.status='completed' AND cj.is_deleted=FALSE) as completed_jobs,
        (SELECT COUNT(*) FROM campaign_jobs cj WHERE cj.country_code = l.country_code AND cj.is_deleted=FALSE) as total_jobs,
        (SELECT COUNT(*) FROM companies c WHERE c.country = l.country_code AND c.is_deleted=FALSE) as total_companies,
        COALESCE((SELECT SUM(cj.businesses_found) FROM campaign_jobs cj WHERE cj.country_code = l.country_code AND cj.is_deleted=FALSE), 0) as businesses_discovered
      FROM locations l
      WHERE l.location_type = 'country' AND l.is_deleted = FALSE AND l.is_active = TRUE
      ORDER BY total_companies DESC
    `);

    const data = result.rows.map((r: any) => ({
      ...r,
      total_states: parseInt(r.total_states),
      total_cities: parseInt(r.total_cities),
      completed_jobs: parseInt(r.completed_jobs),
      total_jobs: parseInt(r.total_jobs),
      total_companies: parseInt(r.total_companies),
      businesses_discovered: parseInt(r.businesses_discovered),
      coverage_pct:
        Math.round((parseInt(r.completed_jobs) / Math.max(parseInt(r.total_cities) * 5, 1)) * 100 * 10) / 10,
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error getting country coverage:', error);
    res.status(500).json({ success: false, message: 'Failed to get country coverage' });
  }
}

export async function getIndustryCoverage(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        i.id as industry_id,
        i.name as industry_name,
        i.parent_id,
        (SELECT COUNT(*) FROM campaign_jobs cj WHERE cj.industry_id = i.id AND cj.status='completed' AND cj.is_deleted=FALSE) as completed_jobs,
        (SELECT COUNT(*) FROM companies c WHERE c.industry = i.name AND c.is_deleted=FALSE) as total_companies
      FROM industries i
      WHERE i.is_deleted = FALSE AND i.is_active = TRUE AND i.parent_id IS NOT NULL
      ORDER BY total_companies DESC
    `);
    res.json({
      success: true,
      data: result.rows.map((r: any) => ({
        ...r,
        completed_jobs: parseInt(r.completed_jobs),
        total_companies: parseInt(r.total_companies),
      })),
    });
  } catch (error) {
    logger.error('Error getting industry coverage:', error);
    res.status(500).json({ success: false, message: 'Failed to get industry coverage' });
  }
}

export async function getDiscoveryHealth(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const [queueSize, activeWorkers, recentFailures, avgSpeed] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM campaign_jobs WHERE status='queued' AND is_deleted=FALSE`),
      pool.query(`SELECT COUNT(*) FROM campaign_jobs WHERE status='running' AND is_deleted=FALSE`),
      pool.query(`
        SELECT error_message, COUNT(*) as count
        FROM campaign_jobs
        WHERE status='failed' AND is_deleted=FALSE AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          AVG(runtime_ms) as avg_runtime_ms,
          AVG(businesses_found) as avg_businesses,
          COUNT(*) FILTER (WHERE status='completed') as completed,
          COUNT(*) FILTER (WHERE status='failed') as failed,
          COUNT(*) as total
        FROM campaign_jobs
        WHERE is_deleted=FALSE AND created_at > NOW() - INTERVAL '24 hours'
      `),
    ]);

    const speed = avgSpeed.rows[0];

    res.json({
      success: true,
      data: {
        queue_size: parseInt(queueSize.rows[0].count),
        active_workers: parseInt(activeWorkers.rows[0].count),
        recent_failures: recentFailures.rows,
        avg_runtime_ms: speed.avg_runtime_ms ? Math.round(parseFloat(speed.avg_runtime_ms)) : 0,
        avg_businesses_per_job: speed.avg_businesses ? Math.round(parseFloat(speed.avg_businesses) * 10) / 10 : 0,
        completed_24h: parseInt(speed.completed || '0'),
        failed_24h: parseInt(speed.failed || '0'),
        total_24h: parseInt(speed.total || '0'),
      },
    });
  } catch (error) {
    logger.error('Error getting discovery health:', error);
    res.status(500).json({ success: false, message: 'Failed to get health stats' });
  }
}

export async function getProviderHealth(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        provider_slug,
        country_code,
        total_requests,
        successful_requests,
        failed_requests,
        CASE WHEN total_requests > 0
          THEN ROUND(successful_requests::numeric / total_requests, 3)
          ELSE 0 END as success_rate,
        avg_latency_ms,
        avg_results_per_request,
        duplicate_rate,
        last_used_at,
        last_error
      FROM provider_metrics
      WHERE is_deleted = FALSE
      ORDER BY provider_slug, country_code
    `);

    const aggregated: Record<string, any> = {};
    for (const row of result.rows) {
      const slug = row.provider_slug;
      if (!aggregated[slug]) {
        aggregated[slug] = {
          provider: slug,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          countries: 0,
          avg_latency_ms: 0,
          last_used_at: null,
          last_error: null,
        };
      }
      const a = aggregated[slug];
      a.total_requests += parseInt(row.total_requests);
      a.successful_requests += parseInt(row.successful_requests);
      a.failed_requests += parseInt(row.failed_requests);
      a.countries += 1;
      a.avg_latency_ms += parseInt(row.avg_latency_ms) * parseInt(row.total_requests);
      if (row.last_used_at && (!a.last_used_at || row.last_used_at > a.last_used_at)) {
        a.last_used_at = row.last_used_at;
      }
      if (row.last_error) a.last_error = row.last_error;
    }

    const data = Object.values(aggregated).map((a: any) => ({
      ...a,
      success_rate: a.total_requests > 0 ? Math.round((a.successful_requests / a.total_requests) * 1000) / 1000 : 0,
      avg_latency_ms: a.total_requests > 0 ? Math.round(a.avg_latency_ms / a.total_requests) : 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error getting provider health:', error);
    res.status(500).json({ success: false, message: 'Failed to get provider health' });
  }
}

export async function getCostStats(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(provider_requests), 0) as total_provider_requests,
        COALESCE(SUM(ai_requests), 0) as total_ai_requests,
        COALESCE(SUM(browser_sessions), 0) as total_browser_sessions,
        COALESCE(SUM(estimated_cost_usd), 0) as total_estimated_cost_usd,
        COALESCE(SUM(total_businesses), 0) as total_businesses_discovered,
        COALESCE(SUM(unique_businesses), 0) as unique_businesses,
        CASE WHEN SUM(total_businesses) > 0
          THEN ROUND(SUM(estimated_cost_usd)::numeric / SUM(total_businesses), 4)
          ELSE 0 END as cost_per_business
      FROM discovery_campaigns
      WHERE is_deleted = FALSE
    `);

    const daily = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as campaigns,
        COALESCE(SUM(total_businesses), 0) as businesses,
        COALESCE(SUM(estimated_cost_usd), 0) as cost
      FROM discovery_campaigns
      WHERE is_deleted = FALSE AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      data: {
        totals: result.rows[0],
        daily: daily.rows,
      },
    });
  } catch (error) {
    logger.error('Error getting cost stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get cost stats' });
  }
}
