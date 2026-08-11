import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export async function createSearchJob(req: Request, res: Response): Promise<void> {
  try {
    const {
      query,
      location = '',
      country = '',
      city = '',
      area = '',
      industry = '',
      keyword = '',
      min_rating = 0,
      min_reviews = 0,
      max_results = 50,
      provider,
      lat,
      lng,
      radius_km = 10,
    } = req.body;

    if (!query && !industry && !keyword) {
      res.status(400).json({
        success: false,
        message: 'At least one of query, industry, or keyword is required',
      });
      return;
    }

    const searchQuery = query || `${industry} ${keyword}`.trim();
    const finalCity = city || (location ? location.trim() : '');
    const finalCountry = country;
    const finalArea = area;
    const metadata: Record<string, unknown> = {};
    if (provider) metadata.provider = provider;
    const hasCoords = lat !== undefined && lat !== null && lng !== undefined && lng !== null;
    if (hasCoords) {
      metadata.lat = Number(lat);
      metadata.lng = Number(lng);
      metadata.radius_km = Number(radius_km) || 10;
    }

    const jobId = uuidv4();
    const pool = getPool();

    const result = await pool.query(
      `
      INSERT INTO search_jobs (id, query, country, city, area, industry, keyword, min_rating, min_reviews, max_results, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'queued', $11::jsonb)
      RETURNING *
    `,
      [
        jobId,
        searchQuery,
        finalCountry,
        finalCity,
        finalArea,
        industry,
        keyword,
        min_rating,
        min_reviews,
        max_results,
        JSON.stringify(metadata),
      ],
    );

    const job = result.rows[0];

    try {
      const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
      await axios.post(`${enqueuerUrl}/enqueue`, {
        task: 'worker.tasks.search.discover_businesses',
        args: [jobId],
        kwargs: {},
        queue: 'search',
      });
      logger.info(`Search job ${jobId} queued successfully`);
    } catch (err) {
      logger.warn(`Could not enqueue task, Celery worker may not be running: ${err}`);
    }

    res.status(201).json({
      success: true,
      data: {
        id: job.id,
        query: job.query,
        country: job.country,
        city: job.city,
        area: job.area,
        industry: job.industry,
        keyword: job.keyword,
        max_results: job.max_results,
        status: job.status,
        progress: job.progress,
        results_count: job.results_count,
        created_at: job.created_at,
        lat: metadata.lat ?? null,
        lng: metadata.lng ?? null,
        radius_km: metadata.radius_km ?? null,
      },
    });
  } catch (error) {
    logger.error('Error creating search job:', error);
    res.status(500).json({ success: false, message: 'Failed to create search job' });
  }
}

export async function listSearchJobs(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM search_jobs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM search_jobs${status ? ' WHERE status = $1' : ''}`,
      status ? [status] : [],
    );
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error listing search jobs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch search jobs' });
  }
}

export async function getSearchJob(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM search_jobs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Search job not found' });
      return;
    }

    const job = result.rows[0];

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'running') {
      const resultsQuery = await pool.query(
        `
        SELECT
          c.id, c.name, c.website, c.phone, c.email, c.industry,
          c.city, c.country, c.area, c.address,
          c.rating, c.review_count, c.logo_url, c.source,
          c.latitude, c.longitude,
          c.google_maps_url, c.description,
          c.twitter, c.tiktok, c.snapchat,
          c.employee_count, c.founded_year,
          COALESCE(l.score, (c.metadata->>'lead_score')::int, 0) as lead_score,
          COALESCE(l.score_label, 'cold') as score_label,
          COALESCE((wa.checks->>'website_score')::int, 0) as website_score,
          COALESCE(wa.seo_score, 0) as seo_score,
          COALESCE(wa.design_score, 0) as design_score,
          COALESCE(wa.overall_score, 0) as opportunity_score,
          wa.recommended_services as ai_recommendation,
          jsonb_build_object(
            'linkedin', COalesce(w.linkedin, c.metadata->>'linkedin_url'),
            'instagram', COALESCE(w.instagram, c.metadata->>'instagram_url'),
            'facebook', COALESCE(w.facebook, c.metadata->>'facebook_url'),
            'whatsapp', COALESCE(w.whatsapp, ''),
            'twitter', c.twitter
          ) as social_links
        FROM search_results sr
        JOIN companies c ON sr.company_id = c.id
        LEFT JOIN leads l ON l.company_id = c.id AND l.is_deleted = false
        LEFT JOIN websites w ON w.company_id = c.id
        LEFT JOIN audits wa ON wa.website_id = w.id
        WHERE sr.search_job_id = $1 AND c.is_deleted = false
        ORDER BY COALESCE(l.score, 0) DESC NULLS LAST
      `,
        [id],
      );

      job.results = resultsQuery.rows;
      job.results_count = resultsQuery.rows.length;
    }

    res.json({ success: true, data: job });
  } catch (error) {
    logger.error('Error fetching search job:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch search job' });
  }
}

export async function cancelSearchJob(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE search_jobs SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'running')
       RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found or cannot be cancelled' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error cancelling search job:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel search job' });
  }
}
