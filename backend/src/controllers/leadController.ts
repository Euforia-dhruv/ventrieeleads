import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function listLeads(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const status = req.query.status as string;
    const city = req.query.city as string;
    const industry = req.query.industry as string;
    const area = req.query.area as string;
    const minScore = parseInt(req.query.minScore as string);
    const maxScore = parseInt(req.query.maxScore as string);
    const source = req.query.source as string;
    const search = req.query.search as string;
    const priority = req.query.priority as string;
    const minRating = parseFloat(req.query.minRating as string);
    const minReviews = parseInt(req.query.minReviews as string);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'DESC';

    // Smart filters (Module 7+8)
    const hasWebsite = req.query.hasWebsite as string;
    const hasEmail = req.query.hasEmail as string;
    const hasPhone = req.query.hasPhone as string;
    const hasWhatsApp = req.query.hasWhatsApp as string;
    const hasInstagram = req.query.hasInstagram as string;
    const hasFacebook = req.query.hasFacebook as string;
    const hasLinkedIn = req.query.hasLinkedIn as string;
    const technology = req.query.technology as string;
    const minWebsiteScore = parseInt(req.query.minWebsiteScore as string);
    const maxWebsiteScore = parseInt(req.query.maxWebsiteScore as string);
    const minSeoScore = parseInt(req.query.minSeoScore as string);
    const minPerformanceScore = parseInt(req.query.minPerformanceScore as string);

    // Opportunity filters (Module 8)
    const noSSL = req.query.noSSL as string;
    const noWhatsApp = req.query.noWhatsApp as string;
    const noBooking = req.query.noBooking as string;
    const slowWebsite = req.query.slowWebsite as string;
    const noAnalytics = req.query.noAnalytics as string;
    const noMetaPixel = req.query.noMetaPixel as string;
    const noContactForm = req.query.noContactForm as string;
    const lowSEO = req.query.lowSEO as string;

    let query = `
      SELECT l.*, c.name as company_name, c.website as company_website,
             c.industry, c.city, c.area, c.country, c.address, c.phone as company_phone,
             c.email as company_email, c.logo_url, c.rating, c.review_count,
             c.google_maps_url, c.screenshot_url, c.twitter, c.tiktok,
             w.title as website_title, w.description as website_description,
             w.emails, w.phone_numbers, w.whatsapp, w.instagram, w.facebook,
             w.linkedin, w.youtube
      FROM leads l
      LEFT JOIN companies c ON l.company_id = c.id
      LEFT JOIN websites w ON c.id = w.company_id
      LEFT JOIN audits a ON a.website_id = (SELECT id FROM websites WHERE company_id = c.id LIMIT 1)
      WHERE l.is_deleted = false
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND l.status = $${paramIndex++}`;
      params.push(status);
    }
    if (city) {
      query += ` AND c.city = $${paramIndex++}`;
      params.push(city);
    }
    if (industry) {
      query += ` AND c.industry = $${paramIndex++}`;
      params.push(industry);
    }
    if (area) {
      query += ` AND c.area = $${paramIndex++}`;
      params.push(area);
    }
    if (minScore !== undefined && !isNaN(minScore)) {
      query += ` AND l.score >= $${paramIndex++}`;
      params.push(minScore);
    }
    if (maxScore !== undefined && !isNaN(maxScore)) {
      query += ` AND l.score <= $${paramIndex++}`;
      params.push(maxScore);
    }
    if (source) {
      query += ` AND l.source = $${paramIndex++}`;
      params.push(source);
    }
    if (priority) {
      query += ` AND l.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (minRating > 0) {
      query += ` AND c.rating >= $${paramIndex++}`;
      params.push(minRating);
    }
    if (minReviews > 0) {
      query += ` AND c.review_count >= $${paramIndex++}`;
      params.push(minReviews);
    }
    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.website ILIKE $${paramIndex} OR c.industry ILIKE $${paramIndex} OR c.city ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Smart filters
    if (hasWebsite === 'true') query += ` AND c.website IS NOT NULL AND c.website != ''`;
    if (hasWebsite === 'false') query += ` AND (c.website IS NULL OR c.website = '')`;
    if (hasEmail === 'true') query += ` AND (c.email IS NOT NULL AND c.email != '')`;
    if (hasEmail === 'false') query += ` AND (c.email IS NULL OR c.email = '')`;
    if (hasPhone === 'true') query += ` AND (c.phone IS NOT NULL AND c.phone != '')`;
    if (hasPhone === 'false') query += ` AND (c.phone IS NULL OR c.phone = '')`;
    if (hasWhatsApp === 'true') query += ` AND w.whatsapp IS NOT NULL AND w.whatsapp != ''`;
    if (hasWhatsApp === 'false') query += ` AND (w.whatsapp IS NULL OR w.whatsapp = '')`;
    if (hasInstagram === 'true') query += ` AND w.instagram IS NOT NULL AND w.instagram != ''`;
    if (hasInstagram === 'false') query += ` AND (w.instagram IS NULL OR w.instagram = '')`;
    if (hasFacebook === 'true') query += ` AND w.facebook IS NOT NULL AND w.facebook != ''`;
    if (hasFacebook === 'false') query += ` AND (w.facebook IS NULL OR w.facebook = '')`;
    if (hasLinkedIn === 'true') query += ` AND w.linkedin IS NOT NULL AND w.linkedin != ''`;
    if (hasLinkedIn === 'false') query += ` AND (w.linkedin IS NULL OR w.linkedin = '')`;
    if (technology) {
      query += ` AND EXISTS (SELECT 1 FROM technologies t WHERE t.company_id = c.id AND t.name ILIKE $${paramIndex})`;
      params.push(`%${technology}%`);
      paramIndex++;
    }
    if (!isNaN(minWebsiteScore)) {
      query += ` AND a.overall_score >= $${paramIndex++}`;
      params.push(minWebsiteScore);
    }
    if (!isNaN(maxWebsiteScore)) {
      query += ` AND a.overall_score <= $${paramIndex++}`;
      params.push(maxWebsiteScore);
    }
    if (!isNaN(minSeoScore)) {
      query += ` AND a.seo_score >= $${paramIndex++}`;
      params.push(minSeoScore);
    }
    if (!isNaN(minPerformanceScore)) {
      query += ` AND a.performance_score >= $${paramIndex++}`;
      params.push(minPerformanceScore);
    }

    // Opportunity filters
    if (noSSL === 'true') query += ` AND (a.checks->>'ssl' = 'false' OR a.checks->>'ssl' IS NULL)`;
    if (noWhatsApp === 'true')
      query += ` AND (a.checks->>'has_whatsapp' = 'false' OR a.checks->>'has_whatsapp' IS NULL)`;
    if (noBooking === 'true') query += ` AND (a.checks->>'has_booking' = 'false' OR a.checks->>'has_booking' IS NULL)`;
    if (slowWebsite === 'true') query += ` AND (a.checks->>'load_time_seconds')::float > 3`;
    if (noAnalytics === 'true')
      query += ` AND (a.checks->>'has_analytics' = 'false' OR a.checks->>'has_analytics' IS NULL)`;
    if (noMetaPixel === 'true')
      query += ` AND (a.checks->>'has_meta_pixel' = 'false' OR a.checks->>'has_meta_pixel' IS NULL)`;
    if (noContactForm === 'true') query += ` AND (a.checks->>'has_cta' = 'false' OR a.checks->>'has_cta' IS NULL)`;
    if (lowSEO === 'true') query += ` AND a.seo_score < 40`;

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const allowedSorts: Record<string, string> = {
      created_at: 'l.created_at',
      score: 'l.score',
      rating: 'c.rating',
      review_count: 'c.review_count',
      company_name: 'c.name',
    };
    const sortField = allowedSorts[sortBy] || 'l.created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
    logger.error('Error listing leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
}

export async function getLead(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT l.*, c.name as company_name, c.website as company_website,
             c.industry, c.city, c.area, c.country, c.address, c.phone as company_phone,
             c.email as company_email, c.logo_url, c.rating, c.review_count,
             c.google_maps_url, c.screenshot_url, c.opening_hours, c.latitude, c.longitude,
             c.metadata as company_metadata,
             w.title as website_title, w.description as website_description,
             w.emails, w.phone_numbers, w.whatsapp, w.instagram, w.facebook,
             w.linkedin, w.youtube, w.contact_page, w.about_page, w.services,
             w.last_crawled
      FROM leads l
      LEFT JOIN companies c ON l.company_id = c.id
      LEFT JOIN websites w ON c.id = w.company_id
      WHERE l.id = $1 AND l.is_deleted = false
    `,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    const lead = result.rows[0];

    const techs = await pool.query(
      'SELECT name, category, version, confidence FROM technologies WHERE company_id = $1',
      [lead.company_id],
    );
    lead.technologies = techs.rows;

    const audits = await pool.query(
      'SELECT * FROM audits WHERE website_id = (SELECT id FROM websites WHERE company_id = $1 LIMIT 1) ORDER BY created_at DESC LIMIT 1',
      [lead.company_id],
    );
    lead.audit = audits.rows[0] || null;

    const activities = await pool.query(
      'SELECT * FROM activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id],
    );
    lead.activities = activities.rows;

    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error fetching lead:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
}

export async function addLead(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const {
      company_name,
      company_website = '',
      city = '',
      country = '',
      industry = '',
      phone = '',
      email = '',
      address = '',
      status = 'New',
      source = 'manual',
    } = req.body;

    const companyResult = await pool.query(
      `
      INSERT INTO companies (name, website, industry, city, country, address, phone, email, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
      [company_name, company_website, industry, city, country, address, phone, email, source],
    );

    const companyId = companyResult.rows[0].id;

    const leadResult = await pool.query(
      `
      INSERT INTO leads (workspace_id, company_id, status, source)
      VALUES ((SELECT id FROM workspaces LIMIT 1), $1, $2, $3)
      RETURNING *
    `,
      [companyId, status, source],
    );

    res.status(201).json({ success: true, data: leadResult.rows[0] });
  } catch (error) {
    logger.error('Error creating lead:', error);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
}

export async function updateLeadHandler(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'status',
      'score',
      'score_label',
      'notes',
      'assigned_to',
      'priority',
      'tags',
      'last_contacted_at',
      'next_follow_up_at',
    ];
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update' });
      return;
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $${paramIndex} AND is_deleted = false RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating lead:', error);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
}

export async function deleteLeadHandler(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE leads SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('Error deleting lead:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
}

export async function leadStats(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      total,
      byStatus,
      byIndustry,
      byCity,
      avgScore,
      todayLeads,
      hotLeads,
      coldLeads,
      qualifiedLeads,
      jobsRunning,
      jobsCompleted,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false'),
      pool.query('SELECT status, COUNT(*) as count FROM leads WHERE is_deleted = false GROUP BY status'),
      pool.query(`
        SELECT c.industry, COUNT(*) as count
        FROM leads l JOIN companies c ON l.company_id = c.id
        WHERE l.is_deleted = false AND c.is_deleted = false
        GROUP BY c.industry ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT c.city, COUNT(*) as count
        FROM leads l JOIN companies c ON l.company_id = c.id
        WHERE l.is_deleted = false AND c.is_deleted = false AND c.city != ''
        GROUP BY c.city ORDER BY count DESC LIMIT 10
      `),
      pool.query('SELECT AVG(score) as avg FROM leads WHERE is_deleted = false'),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false AND created_at >= $1', [todayStart]),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false AND score >= 70'),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false AND score < 40'),
      pool.query(
        "SELECT COUNT(*) FROM leads WHERE is_deleted = false AND status IN ('Qualified', 'Researching', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Negotiation', 'Won')",
      ),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'running'"),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status = 'completed'"),
    ]);

    res.json({
      success: true,
      data: {
        totalLeads: parseInt(total.rows[0].count),
        todayLeads: parseInt(todayLeads.rows[0].count),
        qualifiedLeads: parseInt(qualifiedLeads.rows[0].count),
        hotLeads: parseInt(hotLeads.rows[0].count),
        coldLeads: parseInt(coldLeads.rows[0].count),
        jobsRunning: parseInt(jobsRunning.rows[0].count),
        jobsCompleted: parseInt(jobsCompleted.rows[0].count),
        avgLeadScore: parseFloat(avgScore.rows[0].avg || '0'),
        byStatus: Object.fromEntries(byStatus.rows.map((r: any) => [r.status, parseInt(r.count)])),
        byIndustry: Object.fromEntries(byIndustry.rows.map((r: any) => [r.industry, parseInt(r.count)])),
        byCity: Object.fromEntries(byCity.rows.map((r: any) => [r.city, parseInt(r.count)])),
      },
    });
  } catch (error) {
    logger.error('Error fetching lead stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead stats' });
  }
}
