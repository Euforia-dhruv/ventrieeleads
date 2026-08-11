import { Request, Response } from 'express';
import axios from 'axios';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function getCompanyContacts(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contacts WHERE company_id = $1 AND is_deleted = false ORDER BY is_primary DESC, confidence DESC',
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
}

export async function getCompanyTechnologies(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM technologies WHERE company_id = $1 AND is_deleted = false ORDER BY category, name',
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching technologies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch technologies' });
  }
}

export async function getCompanyAudit(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.* FROM audits a
       JOIN websites w ON w.id = a.website_id
       WHERE w.company_id = $1
       ORDER BY a.created_at DESC LIMIT 1`,
      [id],
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching audit:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit' });
  }
}

export async function enrichCompany(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const company = await pool.query('SELECT * FROM companies WHERE id = $1 AND is_deleted = false', [id]);
    if (company.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    await axios.post(`${enqueuerUrl}/enqueue`, {
      task: 'worker.tasks.process.process_company',
      args: [id],
      kwargs: {},
      queue: 'process',
    });

    res.json({ success: true, message: 'Enrichment job queued', data: { company_id: id } });
  } catch (error) {
    logger.error('Error enriching company:', error);
    res.status(500).json({ success: false, message: 'Failed to queue enrichment' });
  }
}

export async function getCompanyDetail(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const companyResult = await pool.query('SELECT * FROM companies WHERE id = $1 AND is_deleted = false', [id]);
    if (companyResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const company = companyResult.rows[0];

    const [webs, techs, contacts, audits] = await Promise.all([
      pool.query('SELECT * FROM websites WHERE company_id = $1 AND is_deleted = false LIMIT 1', [id]),
      pool.query('SELECT * FROM technologies WHERE company_id = $1 AND is_deleted = false', [id]),
      pool.query('SELECT * FROM contacts WHERE company_id = $1 AND is_deleted = false ORDER BY is_primary DESC', [id]),
      pool.query(
        `SELECT a.* FROM audits a JOIN websites w ON w.id = a.website_id WHERE w.company_id = $1 ORDER BY a.created_at DESC LIMIT 1`,
        [id],
      ),
    ]);

    company.website_data = webs.rows[0] || null;
    company.technologies = techs.rows;
    company.contacts = contacts.rows;
    company.audit = audits.rows[0] || null;

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Error fetching company detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company' });
  }
}
