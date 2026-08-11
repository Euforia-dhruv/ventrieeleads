import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import axios from 'axios';

// ─── MODULE 1: Sales Pipeline ──────────────────────────────────────────────

export async function getPipelineStages(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM pipeline_stages WHERE is_deleted = FALSE AND is_active = TRUE ORDER BY sort_order',
    );
    res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        color: r.color,
        icon: r.icon,
        sort_order: r.sort_order,
      })),
    });
  } catch (error) {
    logger.error('Error getting pipeline stages:', error);
    res.status(500).json({ success: false, message: 'Failed to get stages' });
  }
}

export async function getPipelineOverview(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const stages = await pool.query(
      'SELECT * FROM pipeline_stages WHERE is_deleted = FALSE AND is_active = TRUE ORDER BY sort_order',
    );

    const stageData = [];
    let totalLeads = 0;
    let totalValueMin = 0;
    let totalValueMax = 0;

    for (const stage of stages.rows) {
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM lead_pipeline WHERE stage_id = $1 AND is_deleted = FALSE',
        [stage.id],
      );
      const entriesResult = await pool.query(
        'SELECT COALESCE(SUM(estimated_value_min), 0) as vmin, COALESCE(SUM(estimated_value_max), 0) as vmax, COALESCE(AVG(confidence), 0) as avg_conf FROM lead_pipeline WHERE stage_id = $1 AND is_deleted = FALSE',
        [stage.id],
      );
      const count = parseInt(countResult.rows[0].count);
      const entry = entriesResult.rows[0];
      totalLeads += count;
      totalValueMin += parseInt(entry.vmin);
      totalValueMax += parseInt(entry.vmax);

      stageData.push({
        stage_id: stage.id,
        stage_name: stage.name,
        slug: stage.slug,
        color: stage.color,
        icon: stage.icon,
        count,
        value_min: parseInt(entry.vmin),
        value_max: parseInt(entry.vmax),
        avg_confidence: Math.round(parseFloat(entry.avg_conf) * 100) / 100,
      });
    }

    res.json({
      success: true,
      data: {
        stages: stageData,
        summary: {
          total_leads: totalLeads,
          total_value_min: totalValueMin,
          total_value_max: totalValueMax,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting pipeline overview:', error);
    res.status(500).json({ success: false, message: 'Failed to get pipeline overview' });
  }
}

export async function getPipelineBoard(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const stages = await pool.query(
      'SELECT * FROM pipeline_stages WHERE is_deleted = FALSE AND is_active = TRUE ORDER BY sort_order',
    );

    const stageData = [];
    for (const stage of stages.rows) {
      const leadsResult = await pool.query(
        `
        SELECT lp.id as pipeline_id, lp.lead_id, lp.confidence, lp.estimated_value_min, lp.estimated_value_max,
          l.score, l.company_id, l.status,
          c.name as company_name, c.website, c.logo_url, c.email, c.phone, c.city, c.industry
        FROM lead_pipeline lp
        JOIN leads l ON lp.lead_id = l.id
        LEFT JOIN companies c ON lp.company_id = c.id
        WHERE lp.stage_id = $1 AND lp.is_deleted = FALSE AND l.is_deleted = FALSE
        ORDER BY l.score DESC NULLS LAST
      `,
        [stage.id],
      );

      stageData.push({
        stage_id: stage.id,
        stage_name: stage.name,
        slug: stage.slug,
        color: stage.color,
        icon: stage.icon,
        sort_order: stage.sort_order,
        leads: leadsResult.rows,
      });
    }

    res.json({ success: true, data: { stages: stageData } });
  } catch (error) {
    logger.error('Error getting pipeline board:', error);
    res.status(500).json({ success: false, message: 'Failed to get pipeline board' });
  }
}

export async function getLeadPipeline(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT lp.*, ps.name as stage_name, ps.slug as stage_slug, ps.color as stage_color,
        c.name as company_name, l.company_id
      FROM lead_pipeline lp
      JOIN pipeline_stages ps ON lp.stage_id = ps.id
      JOIN leads l ON lp.lead_id = l.id
      JOIN companies c ON lp.company_id = c.id
      WHERE lp.lead_id = $1 AND lp.is_deleted = FALSE
    `,
      [req.params.leadId],
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const entry = result.rows[0];
    const events = await pool.query(
      `
      SELECT pe.*, ps1.name as from_name, ps2.name as to_name
      FROM pipeline_events pe
      LEFT JOIN pipeline_stages ps1 ON pe.from_stage_id = ps1.id
      JOIN pipeline_stages ps2 ON pe.to_stage_id = ps2.id
      WHERE pe.lead_id = $1 AND pe.is_deleted = FALSE
      ORDER BY pe.created_at
    `,
      [req.params.leadId],
    );

    res.json({
      success: true,
      data: {
        ...entry,
        events: events.rows,
      },
    });
  } catch (error) {
    logger.error('Error getting lead pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to get lead pipeline' });
  }
}

export async function transitionLeadPipeline(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { leadId } = req.params;
    const { to_stage, agent, reason, confidence = 0.5 } = req.body;

    if (!to_stage) {
      res.status(400).json({ success: false, message: 'to_stage is required' });
      return;
    }

    const toStage = await pool.query('SELECT id FROM pipeline_stages WHERE slug = $1 AND is_deleted = FALSE', [
      to_stage,
    ]);
    if (toStage.rows.length === 0) {
      res.status(400).json({ success: false, message: `Invalid stage: ${to_stage}` });
      return;
    }

    let entry = await pool.query('SELECT * FROM lead_pipeline WHERE lead_id = $1 AND is_deleted = FALSE', [leadId]);

    if (entry.rows.length === 0) {
      const lead = await pool.query('SELECT company_id FROM leads WHERE id = $1', [leadId]);
      if (lead.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Lead not found' });
        return;
      }
      const newEntry = await pool.query(
        `
        INSERT INTO lead_pipeline (lead_id, company_id, stage_id, assigned_agent, confidence)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
      `,
        [leadId, lead.rows[0].company_id, toStage.rows[0].id, agent || null, confidence],
      );
      entry = newEntry;
    } else {
      const fromStageId = entry.rows[0].stage_id;
      if (fromStageId === toStage.rows[0].id) {
        res.json({ success: true, message: 'Already in this stage' });
        return;
      }
      await pool.query(
        `
        INSERT INTO pipeline_events (lead_id, pipeline_id, from_stage_id, to_stage_id, agent_name, reason, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [leadId, entry.rows[0].id, fromStageId, toStage.rows[0].id, agent || null, reason || null, confidence],
      );

      await pool.query('UPDATE lead_pipeline SET stage_id = $1, confidence = $2, updated_at = NOW() WHERE id = $3', [
        toStage.rows[0].id,
        confidence,
        entry.rows[0].id,
      ]);
    }

    res.json({ success: true, data: { lead_id: leadId, stage: to_stage } });
  } catch (error) {
    logger.error('Error transitioning lead pipeline:', error);
    res.status(500).json({ success: false, message: 'Failed to transition lead' });
  }
}

export async function getPipelineStats(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const total = await pool.query('SELECT COUNT(*) FROM lead_pipeline WHERE is_deleted = FALSE');
    const won = await pool.query(`
      SELECT COUNT(*) FROM lead_pipeline lp JOIN pipeline_stages ps ON lp.stage_id = ps.id
      WHERE ps.slug = 'won' AND lp.is_deleted = FALSE
    `);
    const lost = await pool.query(`
      SELECT COUNT(*) FROM lead_pipeline lp JOIN pipeline_stages ps ON lp.stage_id = ps.id
      WHERE ps.slug = 'lost' AND lp.is_deleted = FALSE
    `);
    const values = await pool.query(`
      SELECT COALESCE(SUM(estimated_value_max), 0) as total_value FROM lead_pipeline WHERE is_deleted = FALSE
    `);
    const active = await pool.query(`
      SELECT COUNT(*) FROM lead_pipeline lp JOIN pipeline_stages ps ON lp.stage_id = ps.id
      WHERE ps.slug NOT IN ('won', 'lost', 'archived') AND lp.is_deleted = FALSE
    `);

    const t = parseInt(total.rows[0].count);
    const w = parseInt(won.rows[0].count);
    const l = parseInt(lost.rows[0].count);

    res.json({
      success: true,
      data: {
        total: t,
        active: parseInt(active.rows[0].count),
        won: w,
        lost: l,
        win_rate: Math.round((w / Math.max(w + l, 1)) * 1000) / 10,
        total_pipeline_value: parseInt(values.rows[0].total_value),
      },
    });
  } catch (error) {
    logger.error('Error getting pipeline stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
}

// ─── MODULE 4: Client Readiness Score ──────────────────────────────────────

export async function getClientReadiness(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT crs.*, c.name as company_name, c.industry, c.city, c.country
      FROM client_readiness_scores crs
      JOIN companies c ON crs.company_id = c.id
      WHERE crs.company_id = $1 AND crs.is_deleted = FALSE
    `,
      [req.params.companyId],
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null, message: 'No readiness score. Compute via POST.' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting client readiness:', error);
    res.status(500).json({ success: false, message: 'Failed to get readiness' });
  }
}

export async function computeClientReadiness(req: Request, res: Response): Promise<void> {
  try {
    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    const response = await axios.post(`${enqueuerUrl}/enqueue`, {
      task: 'worker.tasks.modules.compute_all_readiness_scores',
      args: [],
      kwargs: {},
      queue: 'process',
    });
    res.json({ success: true, data: { task_id: response.data?.task_id, status: 'queued' } });
  } catch (err: any) {
    logger.warn(`Could not enqueue readiness task: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to compute readiness' });
  }
}

export async function getTopProspects(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(_req.query.limit as string) || 50;
    const result = await pool.query(
      `
      SELECT crs.*, c.name as company_name, c.industry, c.city, c.country,
        c.website, c.email, c.phone, c.rating, c.review_count
      FROM client_readiness_scores crs
      JOIN companies c ON crs.company_id = c.id
      WHERE crs.is_deleted = FALSE AND crs.overall_readiness > 0
      ORDER BY crs.overall_readiness DESC
      LIMIT $1
    `,
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting top prospects:', error);
    res.status(500).json({ success: false, message: 'Failed to get prospects' });
  }
}

// ─── MODULE 5: Negotiation Assistant ───────────────────────────────────────

export async function getNegotiationProfile(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT np.*, c.name as company_name
      FROM negotiation_profiles np
      JOIN companies c ON np.company_id = c.id
      WHERE np.company_id = $1 AND np.is_deleted = FALSE
    `,
      [req.params.companyId],
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null, message: 'No negotiation profile. Generate via POST.' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting negotiation profile:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
}

export async function generateNegotiationProfile(req: Request, res: Response): Promise<void> {
  try {
    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    const response = await axios.post(`${enqueuerUrl}/enqueue`, {
      task: 'worker.tasks.modules.generate_negotiation_profiles',
      args: [],
      kwargs: {},
      queue: 'process',
    });
    res.json({ success: true, data: { task_id: response.data?.task_id, status: 'queued' } });
  } catch (err: any) {
    logger.warn(`Could not enqueue negotiation task: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate profile' });
  }
}

// ─── MODULE 8: Intelligent Automation ──────────────────────────────────────

export async function listAutomationRules(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM automation_rules WHERE is_deleted = FALSE ORDER BY priority DESC, created_at DESC',
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing automation rules:', error);
    res.status(500).json({ success: false, message: 'Failed to list rules' });
  }
}

export async function createAutomationRule(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const {
      name,
      description,
      trigger_event,
      conditions,
      actions,
      cooldown_hours = 24,
      max_executions = 100,
      priority = 5,
    } = req.body;

    if (!name || !trigger_event || !conditions || !actions) {
      res.status(400).json({ success: false, message: 'name, trigger_event, conditions, actions required' });
      return;
    }

    const result = await pool.query(
      `
      INSERT INTO automation_rules (name, description, trigger_event, conditions, actions, cooldown_hours, max_executions, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `,
      [
        name,
        description || null,
        trigger_event,
        JSON.stringify(conditions),
        JSON.stringify(actions),
        cooldown_hours,
        max_executions,
        priority,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating automation rule:', error);
    res.status(500).json({ success: false, message: 'Failed to create rule' });
  }
}

export async function toggleAutomationRule(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('UPDATE automation_rules SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1', [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error toggling automation rule:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle rule' });
  }
}

export async function deleteAutomationRule(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('UPDATE automation_rules SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1', [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting automation rule:', error);
    res.status(500).json({ success: false, message: 'Failed to delete rule' });
  }
}

export async function getAutomationExecutions(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(_req.query.limit as string) || 50;
    const result = await pool.query(
      `
      SELECT ae.*, ar.name as rule_name
      FROM automation_executions ae
      JOIN automation_rules ar ON ae.rule_id = ar.id
      WHERE ae.is_deleted = FALSE
      ORDER BY ae.created_at DESC LIMIT $1
    `,
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting automation executions:', error);
    res.status(500).json({ success: false, message: 'Failed to get executions' });
  }
}

export async function getAutomationStats(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const [rules, active, execs, success] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM automation_rules WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM automation_rules WHERE is_deleted = FALSE AND is_active = TRUE'),
      pool.query('SELECT COUNT(*) FROM automation_executions WHERE is_deleted = FALSE'),
      pool.query("SELECT COUNT(*) FROM automation_executions WHERE is_deleted = FALSE AND status = 'success'"),
    ]);
    res.json({
      success: true,
      data: {
        total_rules: parseInt(rules.rows[0].count),
        active_rules: parseInt(active.rows[0].count),
        total_executions: parseInt(execs.rows[0].count),
        success_rate:
          Math.round((parseInt(success.rows[0].count) / Math.max(parseInt(execs.rows[0].count), 1)) * 1000) / 10,
      },
    });
  } catch (error) {
    logger.error('Error getting automation stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
}

// ─── MODULE 9: Autonomous Improvement ──────────────────────────────────────

export async function getImprovementReports(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM improvement_reports WHERE is_deleted = FALSE ORDER BY report_date DESC LIMIT 30',
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting improvement reports:', error);
    res.status(500).json({ success: false, message: 'Failed to get reports' });
  }
}

// ─── MODULE 11: Observability ──────────────────────────────────────────────

export async function getSystemOverview(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000).toISOString();

    const [companies, leads, activeSearches, recentCompleted, recentFailed, recentQueued] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = FALSE'),
      pool.query("SELECT COUNT(*) FROM search_jobs WHERE status IN ('queued', 'running')"),
      pool.query(
        "SELECT COUNT(*) FROM campaign_jobs WHERE created_at > $1 AND status = 'completed' AND is_deleted = FALSE",
        [dayAgo],
      ),
      pool.query(
        "SELECT COUNT(*) FROM campaign_jobs WHERE created_at > $1 AND status = 'failed' AND is_deleted = FALSE",
        [dayAgo],
      ),
      pool.query("SELECT COUNT(*) FROM campaign_jobs WHERE status = 'queued' AND is_deleted = FALSE"),
    ]);

    const rc = parseInt(recentCompleted.rows[0].count);
    const rf = parseInt(recentFailed.rows[0].count);

    const pipeline = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ps.slug NOT IN ('won', 'lost', 'archived')) as active,
        COUNT(*) FILTER (WHERE ps.slug = 'won') as won,
        COUNT(*) FILTER (WHERE ps.slug = 'lost') as lost,
        COALESCE(SUM(estimated_value_max), 0) as total_value
      FROM lead_pipeline lp
      JOIN pipeline_stages ps ON lp.stage_id = ps.id
      WHERE lp.is_deleted = FALSE
    `);

    const p = pipeline.rows[0];

    res.json({
      success: true,
      data: {
        timestamp: now.toISOString(),
        data: {
          total_companies: parseInt(companies.rows[0].count),
          total_leads: parseInt(leads.rows[0].count),
          active_searches: parseInt(activeSearches.rows[0].count),
        },
        last_24h: {
          completed: rc,
          failed: rf,
          queued: parseInt(recentQueued.rows[0].count),
          success_rate: Math.round((rc / Math.max(rc + rf, 1)) * 1000) / 10,
        },
        pipeline: {
          total: parseInt(p.total),
          active: parseInt(p.active),
          won: parseInt(p.won),
          lost: parseInt(p.lost),
          win_rate: Math.round((parseInt(p.won) / Math.max(parseInt(p.won) + parseInt(p.lost), 1)) * 1000) / 10,
          total_value: parseInt(p.total_value),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting system overview:', error);
    res.status(500).json({ success: false, message: 'Failed to get overview' });
  }
}

export async function getMetricsHistory(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const category = req.query.category as string;
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 3600000).toISOString();

    let query = 'SELECT * FROM system_metrics WHERE recorded_at > $1';
    const params: any[] = [since];
    if (category) {
      query += ' AND metric_category = $2';
      params.push(category);
    }
    query += ' ORDER BY recorded_at DESC LIMIT 500';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting metrics history:', error);
    res.status(500).json({ success: false, message: 'Failed to get metrics' });
  }
}

export async function getMorningBriefing(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT * FROM executive_ai_reports WHERE report_type = 'morning_briefing' ORDER BY report_date DESC LIMIT 1",
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error getting morning briefing:', error);
    res.status(500).json({ success: false, message: 'Failed to get briefing' });
  }
}

export async function triggerMorningBriefing(_req: Request, res: Response): Promise<void> {
  try {
    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    const response = await axios.post(`${enqueuerUrl}/enqueue`, {
      task: 'worker.tasks.modules.morning_executive_briefing',
      args: [],
      kwargs: {},
      queue: 'process',
    });
    res.json({ success: true, data: { task_id: response.data?.task_id, status: 'queued' } });
  } catch (err: any) {
    logger.warn(`Could not enqueue briefing task: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to trigger briefing' });
  }
}

// ─── MODULE 6: Learning Engine ─────────────────────────────────────────────

export async function getLearningSignals(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(_req.query.limit as string) || 100;
    const result = await pool.query(
      'SELECT * FROM learning_signals WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error getting learning signals:', error);
    res.status(500).json({ success: false, message: 'Failed to get signals' });
  }
}

export async function getLearningPerformance(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const days = parseInt(_req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const result = await pool.query(
      `
      SELECT signal_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE outcome IN ('won', 'accepted', 'replied', 'completed')) as positive,
        COUNT(*) FILTER (WHERE outcome NOT IN ('won', 'accepted', 'replied', 'completed')) as negative,
        COALESCE(AVG(error_margin), 0) as avg_error
      FROM learning_signals
      WHERE created_at > $1 AND is_deleted = FALSE
      GROUP BY signal_type
    `,
      [since],
    );
    res.json({
      success: true,
      data: {
        period_days: days,
        total_signals: result.rows.reduce((s: number, r: any) => s + parseInt(r.total), 0),
        by_type: result.rows.reduce((acc: any, r: any) => {
          acc[r.signal_type] = {
            total: parseInt(r.total),
            positive: parseInt(r.positive),
            negative: parseInt(r.negative),
            accuracy: Math.round((parseInt(r.positive) / Math.max(parseInt(r.total), 1)) * 1000) / 10,
            avg_error: Math.round(parseFloat(r.avg_error) * 1000) / 1000,
          };
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logger.error('Error getting learning performance:', error);
    res.status(500).json({ success: false, message: 'Failed to get performance' });
  }
}

export async function recordLearningSignal(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { signal_type, entity_type, entity_id, outcome, feature_snapshot, prediction, agent_name } = req.body;

    if (!signal_type || !entity_type || !outcome) {
      res.status(400).json({ success: false, message: 'signal_type, entity_type, outcome required' });
      return;
    }

    const result = await pool.query(
      `
      INSERT INTO learning_signals (signal_type, entity_type, entity_id, outcome, feature_snapshot, prediction, agent_name, error_margin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `,
      [
        signal_type,
        entity_type,
        entity_id || null,
        outcome,
        JSON.stringify(feature_snapshot || {}),
        JSON.stringify(prediction || {}),
        agent_name || null,
        Math.abs(
          ((prediction || {}).confidence || 0) -
            (['won', 'accepted', 'replied', 'completed'].includes(outcome) ? 1 : 0),
        ),
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error recording learning signal:', error);
    res.status(500).json({ success: false, message: 'Failed to record signal' });
  }
}
