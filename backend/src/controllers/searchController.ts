import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface SearchJob {
  id: string;
  query: string;
  country: string;
  city: string;
  area: string;
  industry: string;
  keyword: string;
  min_rating: number;
  min_reviews: number;
  max_results: number;
  status: string;
  progress: number;
  results_count: number;
  error_message: string | null;
  celery_task_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function createSearchJob(req: Request, res: Response): Promise<void> {
  try {
    const {
      query,
      country = '',
      city = '',
      area = '',
      industry = '',
      keyword = '',
      min_rating = 0,
      min_reviews = 0,
      max_results = 50
    } = req.body;

    if (!query && !industry && !keyword) {
      res.status(400).json({
        success: false,
        message: 'At least one of query, industry, or keyword is required'
      });
      return;
    }

    const jobId = uuidv4();
    const pool = getPool();

    const searchQuery = query || `${industry} ${keyword}`.trim();
    const result = await pool.query(`
      INSERT INTO search_jobs (id, query, country, city, area, industry, keyword, min_rating, min_reviews, max_results, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'queued')
      RETURNING *
    `, [jobId, searchQuery, country, city, area, industry, keyword, min_rating, min_reviews, max_results]);

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
        created_at: job.created_at
      }
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
      status ? [status] : []
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
        pages: Math.ceil(total / limit)
      }
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

    res.json({ success: true, data: result.rows[0] });
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
      [id]
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
