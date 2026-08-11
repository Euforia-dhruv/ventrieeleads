import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export const generateProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id, template, branding } = req.body;
    const pool = getPool();
    const companyResult = await pool.query(
      `SELECT c.*, w.url as website_url, w.title as website_title, w.description as website_desc,
              a.overall_score, a.seo_score, a.performance_score, a.design_score,
              a.conversion_score, a.trust_score, a.weaknesses, a.quick_wins, a.recommended_services
       FROM companies c
       LEFT JOIN websites w ON w.company_id = c.id
       LEFT JOIN audits a ON a.website_id = w.id
       WHERE c.id = $1`,
      [company_id],
    );
    if (companyResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const company = companyResult.rows[0];

    const researchResult = await pool.query(
      `SELECT * FROM company_research WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 1`,
      [company_id],
    );
    const research = researchResult.rows[0] || null;

    const competitorResult = await pool.query(
      `SELECT * FROM competitor_analyses WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 5`,
      [company_id],
    );
    const competitors = competitorResult.rows;

    const response = await fetch(`${process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002'}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id, task_type: 'proposal', company, research, competitors, template, branding }),
    });
    const result: any = await response.json();

    const proposalResult = await pool.query(
      `INSERT INTO proposals (company_id, title, status, services, generated_by_ai)
       VALUES ($1, $2, 'generating', $3, true) RETURNING id`,
      [company_id, `Proposal for ${company.name}`, research?.recommended_services || []],
    );

    res.json({ success: true, data: { proposal_id: proposalResult.rows[0].id, task_id: result.task_id } });
  } catch (error) {
    logger.error('Failed to generate proposal', error);
    res.status(500).json({ success: false, message: 'Failed to generate proposal' });
  }
};

export const listProposals = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT p.*, c.name as company_name, c.industry, c.city
       FROM proposals p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.is_deleted = false
       ORDER BY p.created_at DESC LIMIT 100`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Failed to list proposals', error);
    res.status(500).json({ success: false, message: 'Failed to list proposals' });
  }
};

export const getProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT p.*, c.name as company_name, c.industry, c.city, c.website, c.rating, c.review_count
       FROM proposals p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.id = $1 AND p.is_deleted = false`,
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Failed to get proposal', error);
    res.status(500).json({ success: false, message: 'Failed to get proposal' });
  }
};

export const generateCopy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id, type, tone, context } = req.body;
    const pool = getPool();
    const companyResult = await pool.query(
      `SELECT c.*, w.url as website_url, a.overall_score, a.seo_score, a.weaknesses
       FROM companies c
       LEFT JOIN websites w ON w.company_id = c.id
       LEFT JOIN audits a ON a.website_id = w.id
       WHERE c.id = $1`,
      [company_id],
    );
    if (companyResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const company = companyResult.rows[0];

    const researchResult = await pool.query(
      `SELECT * FROM company_research WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 1`,
      [company_id],
    );
    const research = researchResult.rows[0] || null;

    res.json({
      success: true,
      data: {
        company: { name: company.name, industry: company.industry, city: company.city, website: company.website },
        research: research
          ? {
              pain_points: research.likely_pain_points,
              talking_points: research.sales_talking_points,
              recommended_services: research.recommended_services,
            }
          : null,
        type,
        tone,
        context,
        message: `Copy generation queued for ${company.name}. Use the AI client to generate ${type} content with ${tone} tone.`,
      },
    });
  } catch (error) {
    logger.error('Failed to generate copy', error);
    res.status(500).json({ success: false, message: 'Failed to generate copy' });
  }
};

export const generateRedesign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id, style, color_palette } = req.body;
    const pool = getPool();
    const companyResult = await pool.query(
      `SELECT c.*, w.url as website_url, w.title as website_title,
              a.overall_score, a.design_score, a.weaknesses, a.quick_wins
       FROM companies c
       LEFT JOIN websites w ON w.company_id = c.id
       LEFT JOIN audits a ON a.website_id = w.id
       WHERE c.id = $1`,
      [company_id],
    );
    if (companyResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const previewResult = await pool.query(
      `INSERT INTO redesign_previews (company_id, redesign_style, color_scheme, changes_made)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [company_id, style || 'modern', JSON.stringify(color_palette || {}), JSON.stringify([])],
    );

    res.json({
      success: true,
      data: {
        preview_id: previewResult.rows[0].id,
        company: companyResult.rows[0],
      },
    });
  } catch (error) {
    logger.error('Failed to generate redesign', error);
    res.status(500).json({ success: false, message: 'Failed to generate redesign' });
  }
};

export const getCompanyTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [research, audits, monitoring, proposals] = await Promise.all([
      pool.query(
        `SELECT * FROM company_research WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC`,
        [id],
      ),
      pool.query(
        `SELECT a.* FROM audits a JOIN websites w ON a.website_id = w.id WHERE w.company_id = $1 AND a.is_deleted = false ORDER BY a.created_at DESC`,
        [id],
      ),
      pool.query(
        `SELECT * FROM monitoring_snapshots WHERE company_id = $1 AND changes_detected != '[]' ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
      pool.query(`SELECT * FROM proposals WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC`, [id]),
    ]);

    const events: any[] = [];

    research.rows.forEach((r) => events.push({ type: 'research', date: r.created_at, data: r }));
    audits.rows.forEach((a) => events.push({ type: 'audit', date: a.created_at, data: a }));
    monitoring.rows.forEach((m) => events.push({ type: 'monitoring', date: m.created_at, data: m }));
    proposals.rows.forEach((p) => events.push({ type: 'proposal', date: p.created_at, data: p }));

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, data: events.slice(0, 50) });
  } catch (error) {
    logger.error('Failed to get company timeline', error);
    res.status(500).json({ success: false, message: 'Failed to get company timeline' });
  }
};

export const getSalesPlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const companyResult = await pool.query(
      `SELECT c.*, w.url as website_url,
              a.overall_score, a.seo_score, a.performance_score, a.design_score,
              a.conversion_score, a.trust_score, a.weaknesses, a.quick_wins, a.recommended_services
       FROM companies c
       LEFT JOIN websites w ON w.company_id = c.id
       LEFT JOIN audits a ON a.website_id = w.id
       WHERE c.id = $1`,
      [id],
    );
    if (companyResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    const company = companyResult.rows[0];

    const researchResult = await pool.query(
      `SELECT * FROM company_research WHERE company_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    const research = researchResult.rows[0] || null;

    const opportunityResult = await pool.query(
      `SELECT o.* FROM opportunities o JOIN leads l ON o.lead_id = l.id WHERE l.company_id = $1 LIMIT 1`,
      [id],
    );
    const opportunity = opportunityResult.rows[0] || null;

    const services: string[] = [];
    const scores = {
      overall: company.overall_score || 0,
      seo: company.seo_score || 0,
      performance: company.performance_score || 0,
      design: company.design_score || 0,
      conversion: company.conversion_score || 0,
      trust: company.trust_score || 0,
    };

    if (scores.seo < 60) services.push('SEO Optimization');
    if (scores.design < 60) services.push('Website Redesign');
    if (scores.performance < 60) services.push('Performance Optimization');
    if (scores.conversion < 60) services.push('Conversion Rate Optimization');
    if (scores.trust < 60) services.push('Trust & Credibility Upgrade');
    if (!company.website) services.push('Website Development');

    let urgency = 'medium';
    if (scores.overall < 30) urgency = 'critical';
    else if (scores.overall < 50) urgency = 'high';
    else if (scores.overall > 70) urgency = 'low';

    const closeProbability = Math.min(95, Math.max(10, 100 - scores.overall + (research ? 15 : 0)));

    res.json({
      success: true,
      data: {
        company: { name: company.name, industry: company.industry, city: company.city, website: company.website },
        scores,
        services,
        urgency,
        close_probability: closeProbability,
        pricing_range: opportunity ? { min: opportunity.total_min, max: opportunity.total_max } : null,
        research: research
          ? {
              pain_points: research.likely_pain_points,
              talking_points: research.sales_talking_points,
              recommended_services: research.recommended_services,
              priority: research.priority,
              estimated_budget: research.estimated_budget,
            }
          : null,
        recommended_first_message: `Hi, I noticed ${company.name} in ${company.city || 'your area'}. I specialize in helping ${company.industry || 'businesses'} improve their online presence. I noticed a few areas where your website could perform better...`,
      },
    });
  } catch (error) {
    logger.error('Failed to get sales playbook', error);
    res.status(500).json({ success: false, message: 'Failed to get sales playbook' });
  }
};

export const getExecutiveStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const [leads, companies, research, proposals, reports, monitoring, opportunities] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE score >= 70) as hot, COUNT(*) FILTER (WHERE status = 'Won') as won, AVG(score) as avg_score FROM leads WHERE is_deleted = false`,
      ),
      pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_monitored = true) as monitored FROM companies WHERE is_deleted = false`,
      ),
      pool.query(`SELECT COUNT(*) as total FROM company_research WHERE is_deleted = false`),
      pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'sent') as sent, COUNT(*) FILTER (WHERE status = 'accepted') as accepted FROM proposals WHERE is_deleted = false`,
      ),
      pool.query(`SELECT COUNT(*) as total FROM reports WHERE is_deleted = false`),
      pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE changes_detected != '[]') as with_changes FROM monitoring_snapshots`,
      ),
      pool.query(
        `SELECT SUM(total_min) as pipeline_min, SUM(total_max) as pipeline_max, COUNT(*) as total FROM opportunities`,
      ),
    ]);

    res.json({
      success: true,
      data: {
        total_leads: parseInt(leads.rows[0].total),
        hot_leads: parseInt(leads.rows[0].hot),
        won_leads: parseInt(leads.rows[0].won),
        avg_score: Math.round(parseFloat(leads.rows[0].avg_score) || 0),
        total_companies: parseInt(companies.rows[0].total),
        monitored_companies: parseInt(companies.rows[0].monitored),
        total_research: parseInt(research.rows[0].total),
        total_proposals: parseInt(proposals.rows[0].total),
        sent_proposals: parseInt(proposals.rows[0].sent),
        accepted_proposals: parseInt(proposals.rows[0].accepted),
        total_reports: parseInt(reports.rows[0].total),
        total_snapshots: parseInt(monitoring.rows[0].total),
        change_alerts: parseInt(monitoring.rows[0].with_changes),
        pipeline_min: parseInt(opportunities.rows[0].pipeline_min) || 0,
        pipeline_max: parseInt(opportunities.rows[0].pipeline_max) || 0,
        total_opportunities: parseInt(opportunities.rows[0].total),
      },
    });
  } catch (error) {
    logger.error('Failed to get executive stats', error);
    res.status(500).json({ success: false, message: 'Failed to get executive stats' });
  }
};
