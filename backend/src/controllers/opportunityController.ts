import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

const SERVICE_RATES = {
  website_redesign: { min: 55000, max: 275000, label: 'Website Redesign' },
  seo: { min: 15000, max: 75000, label: 'SEO Optimization' },
  branding: { min: 25000, max: 120000, label: 'Brand Identity' },
  performance: { min: 10000, max: 50000, label: 'Performance Optimisation' },
  booking_engine: { min: 20000, max: 80000, label: 'Booking Engine' },
  ai_chatbot: { min: 15000, max: 60000, label: 'AI Chatbot' },
  analytics: { min: 5000, max: 25000, label: 'Analytics Setup' },
  maintenance: { min: 2000, max: 8000, label: 'Monthly Maintenance' },
};

export async function getOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { leadId } = req.params;
    const result = await pool.query('SELECT * FROM opportunities WHERE lead_id = $1', [leadId]);
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching opportunity:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch opportunity' });
  }
}

export async function estimateOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { leadId } = req.params;

    const leadResult = await pool.query(
      `
      SELECT l.*, c.name as company_name, c.industry, c.city
      FROM leads l JOIN companies c ON l.company_id = c.id WHERE l.id = $1
    `,
      [leadId],
    );

    if (leadResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    const lead = leadResult.rows[0];

    const auditResult = await pool.query(
      `
      SELECT a.* FROM audits a
      JOIN websites w ON w.id = a.website_id
      WHERE w.company_id = $1 ORDER BY a.created_at DESC LIMIT 1
    `,
      [lead.company_id],
    );

    const audit = auditResult.rows[0];
    const recommended: string[] = [];
    const est: any = {};

    for (const [key] of Object.entries(SERVICE_RATES)) {
      est[`${key}_min`] = 0;
      est[`${key}_max`] = 0;
    }

    if (audit) {
      if (audit.overall_score < 60) {
        est.website_redesign_min = SERVICE_RATES.website_redesign.min;
        est.website_redesign_max = SERVICE_RATES.website_redesign.max;
        recommended.push('Website Redesign');
      }
      if (audit.seo_score < 60) {
        est.seo_min = SERVICE_RATES.seo.min;
        est.seo_max = SERVICE_RATES.seo.max;
        recommended.push('SEO Optimization');
      }
      if (audit.performance_score < 60) {
        est.performance_min = SERVICE_RATES.performance.min;
        est.performance_max = SERVICE_RATES.performance.max;
        recommended.push('Performance Optimisation');
      }
      if (audit.design_score < 60) {
        est.branding_min = SERVICE_RATES.branding.min;
        est.branding_max = SERVICE_RATES.branding.max;
        recommended.push('Brand Identity');
      }
      if (audit.conversion_score < 60) {
        est.booking_engine_min = SERVICE_RATES.booking_engine.min;
        est.booking_engine_max = SERVICE_RATES.booking_engine.max;
        est.ai_chatbot_min = SERVICE_RATES.ai_chatbot.min;
        est.ai_chatbot_max = SERVICE_RATES.ai_chatbot.max;
        recommended.push('Booking Engine');
        recommended.push('AI Chatbot');
      }
      est.analytics_min = SERVICE_RATES.analytics.min;
      est.analytics_max = SERVICE_RATES.analytics.max;
      est.maintenance_min = SERVICE_RATES.maintenance.min;
      est.maintenance_max = SERVICE_RATES.maintenance.max;
      if (recommended.length === 0) {
        recommended.push('Monthly Maintenance');
      }
    } else {
      est.website_redesign_min = SERVICE_RATES.website_redesign.min;
      est.website_redesign_max = SERVICE_RATES.website_redesign.max;
      recommended.push('Website Redesign');
    }

    let totalMin = 0,
      totalMax = 0;
    for (const key of Object.keys(SERVICE_RATES)) {
      totalMin += est[`${key}_min`];
      totalMax += est[`${key}_max`];
    }

    const confidence = audit ? 0.75 : 0.4;
    const priority = totalMin > 100000 ? 'high' : totalMin > 50000 ? 'medium' : 'low';

    const oppData = {
      lead_id: leadId,
      ...est,
      total_min: totalMin,
      total_max: totalMax,
      confidence,
      recommended_services: JSON.stringify(recommended),
      priority,
    };

    await pool.query(
      `
      INSERT INTO opportunities (lead_id, ${Object.keys(SERVICE_RATES)
        .map((k) => k + '_min, ' + k + '_max')
        .join(', ')},
        total_min, total_max, confidence, recommended_services, priority)
      VALUES ($1, ${Object.keys(SERVICE_RATES)
        .map((_, i) => `$${i * 2 + 2}, $${i * 2 + 3}`)
        .join(', ')},
        $${Object.keys(SERVICE_RATES).length * 2 + 2}, $${Object.keys(SERVICE_RATES).length * 2 + 3},
        $${Object.keys(SERVICE_RATES).length * 2 + 4}, $${Object.keys(SERVICE_RATES).length * 2 + 5}::jsonb,
        $${Object.keys(SERVICE_RATES).length * 2 + 6})
      ON CONFLICT (lead_id) DO UPDATE SET
        ${Object.keys(SERVICE_RATES)
          .map((k) => `${k}_min = EXCLUDED.${k}_min, ${k}_max = EXCLUDED.${k}_max`)
          .join(', ')},
        total_min = EXCLUDED.total_min, total_max = EXCLUDED.total_max,
        confidence = EXCLUDED.confidence, recommended_services = EXCLUDED.recommended_services,
        priority = EXCLUDED.priority, updated_at = NOW()
      RETURNING *
    `,
      [
        leadId,
        ...Object.keys(SERVICE_RATES).flatMap((k) => [oppData[`${k}_min`], oppData[`${k}_max`]]),
        totalMin,
        totalMax,
        confidence,
        JSON.stringify(recommended),
        priority,
      ],
    );

    res.json({
      success: true,
      data: {
        lead_id: leadId,
        ...est,
        total_min: totalMin,
        total_max: totalMax,
        confidence,
        recommended_services: recommended,
        priority,
      },
    });
  } catch (error) {
    logger.error('Error estimating opportunity:', error);
    res.status(500).json({ success: false, message: 'Failed to estimate opportunity' });
  }
}
