import { Request, Response } from 'express';
import axios from 'axios';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';

export async function listScheduledSearches(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scheduled_searches ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing scheduled searches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scheduled searches' });
  }
}

export async function createScheduledSearch(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const {
      name,
      query,
      country = '',
      city = '',
      area = '',
      industry = '',
      keyword = '',
      min_rating,
      min_reviews,
      max_results = 50,
      schedule_type = 'daily',
      cron_expression,
    } = req.body;

    if (!name || !query) {
      res.status(400).json({ success: false, message: 'Name and query are required' });
      return;
    }

    const nextRun = computeNextRun(schedule_type, cron_expression);
    const result = await pool.query(
      `
      INSERT INTO scheduled_searches (id, name, query, country, city, area, industry, keyword,
        min_rating, min_reviews, max_results, schedule_type, cron_expression, next_run_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `,
      [
        uuidv4(),
        name,
        query,
        country,
        city,
        area,
        industry,
        keyword,
        min_rating || null,
        min_reviews || null,
        max_results,
        schedule_type,
        cron_expression || null,
        nextRun,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating scheduled search:', error);
    res.status(500).json({ success: false, message: 'Failed to create scheduled search' });
  }
}

export async function updateScheduledSearch(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const updates = req.body;

    const allowed = [
      'name',
      'query',
      'country',
      'city',
      'area',
      'industry',
      'keyword',
      'min_rating',
      'min_reviews',
      'max_results',
      'schedule_type',
      'cron_expression',
      'is_active',
    ];
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        values.push(updates[field]);
      }
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE scheduled_searches SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Scheduled search not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating scheduled search:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
}

export async function deleteScheduledSearch(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM scheduled_searches WHERE id = $1', [req.params.id]);
    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Error deleting scheduled search:', error);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
}

export async function runScheduledSearchNow(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const ss = await pool.query('SELECT * FROM scheduled_searches WHERE id = $1', [id]);
    if (ss.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }
    const s = ss.rows[0];
    const jobId = uuidv4();
    await pool.query(
      `
      INSERT INTO search_jobs (id, query, country, city, area, industry, keyword, min_rating, min_reviews, max_results, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'queued')
    `,
      [jobId, s.query, s.country, s.city, s.area, s.industry, s.keyword, s.min_rating, s.min_reviews, s.max_results],
    );

    try {
      const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
      await axios.post(`${enqueuerUrl}/enqueue`, {
        task: 'worker.tasks.search.discover_businesses',
        args: [jobId],
        kwargs: {},
        queue: 'search',
      });
    } catch (e) {
      logger.warn(`Could not enqueue: ${e}`);
    }

    await pool.query(
      'UPDATE scheduled_searches SET last_run_at = NOW(), total_runs = total_runs + 1, updated_at = NOW() WHERE id = $1',
      [id],
    );

    res.json({ success: true, data: { job_id: jobId } });
  } catch (error) {
    logger.error('Error running scheduled search:', error);
    res.status(500).json({ success: false, message: 'Failed to run' });
  }
}

function computeNextRun(type: string, _cron?: string): Date {
  const now = new Date();
  switch (type) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  return now;
}
