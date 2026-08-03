import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

const TASK_ENQUEUER_URL = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';

export async function listAgents(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT a.*,
        (SELECT COUNT(*) FROM agent_executions e WHERE e.agent_name = a.agent_name) AS execution_count,
        (SELECT COUNT(*) FROM agent_executions e WHERE e.agent_name = a.agent_name AND e.status = 'completed') AS success_count
      FROM agent_states a
      ORDER BY a.agent_name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing agents:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agents' });
  }
}

export async function getAgent(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name } = req.params;
    const state = await pool.query('SELECT * FROM agent_states WHERE agent_name = $1', [name]);
    if (!state.rows.length) {
      res.status(404).json({ success: false, message: 'Agent not found' });
      return;
    }
    const executions = await pool.query(
      'SELECT * FROM agent_executions WHERE agent_name = $1 ORDER BY created_at DESC LIMIT 20',
      [name]
    );
    const memory = await pool.query(
      'SELECT * FROM agent_memory WHERE agent_name = $1 ORDER BY created_at DESC LIMIT 50',
      [name]
    );
    res.json({
      success: true,
      data: {
        ...state.rows[0],
        recent_executions: executions.rows,
        memory: memory.rows,
      }
    });
  } catch (error) {
    logger.error('Error fetching agent:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agent' });
  }
}

export async function runAgent(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.params;
    const pool = getPool();
    const state = await pool.query('SELECT * FROM agent_states WHERE agent_name = $1', [name]);
    if (!state.rows.length) {
      res.status(404).json({ success: false, message: 'Agent not found' });
      return;
    }
    const response = await fetch(`${TASK_ENQUEUER_URL}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: name, context: req.body.context || {} }),
    });
    const result = await response.json() as any;
    res.json({ success: true, data: { agent_name: name, task_id: result.task_id, status: 'queued' } });
  } catch (error) {
    logger.error('Error running agent:', error);
    res.status(500).json({ success: false, message: 'Failed to run agent' });
  }
}

export async function runAllAgents(req: Request, res: Response): Promise<void> {
  try {
    const response = await fetch(`${TASK_ENQUEUER_URL}/agent/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: req.body.context || {} }),
    });
    const result = await response.json() as any;
    res.json({ success: true, data: { task_id: result.task_id, status: 'queued' } });
  } catch (error) {
    logger.error('Error running all agents:', error);
    res.status(500).json({ success: false, message: 'Failed to run agents' });
  }
}

export async function getAgentExecutions(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await pool.query(
      'SELECT * FROM agent_executions WHERE agent_name = $1 ORDER BY created_at DESC LIMIT $2',
      [name, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching executions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch executions' });
  }
}

export async function getAgentMemory(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { name } = req.params;
    const result = await pool.query(
      'SELECT * FROM agent_memory WHERE agent_name = $1 ORDER BY access_count DESC, created_at DESC LIMIT 100',
      [name]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching memory:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch memory' });
  }
}

export async function getKnowledgeGraph(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await pool.query(
      'SELECT * FROM knowledge_edges ORDER BY weight DESC LIMIT $1',
      [limit]
    );
    const stats = await pool.query(`
      SELECT relationship, COUNT(*) AS count
      FROM knowledge_edges
      GROUP BY relationship
      ORDER BY count DESC
    `);
    res.json({
      success: true,
      data: {
        edges: result.rows,
        relationship_stats: stats.rows,
        total_edges: result.rowCount,
      }
    });
  } catch (error) {
    logger.error('Error fetching knowledge graph:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge graph' });
  }
}

export async function getExecutiveBriefings(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 30;
    const result = await pool.query(
      'SELECT * FROM executive_briefings ORDER BY briefing_date DESC LIMIT $1',
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching briefings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch briefings' });
  }
}

export async function generateBriefing(req: Request, res: Response): Promise<void> {
  try {
    const response = await fetch(`${TASK_ENQUEUER_URL}/agent/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json() as any;
    res.json({ success: true, data: { task_id: result.task_id, status: 'queued' } });
  } catch (error) {
    logger.error('Error generating briefing:', error);
    res.status(500).json({ success: false, message: 'Failed to generate briefing' });
  }
}

export async function intelligentSearch(req: Request, res: Response): Promise<void> {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ success: false, message: 'Query is required' });
      return;
    }
    const response = await fetch(`${TASK_ENQUEUER_URL}/intelligence/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const result = await response.json() as any;
    res.json({ success: true, data: { task_id: result.task_id, status: 'queued', query } });
  } catch (error) {
    logger.error('Error with intelligent search:', error);
    res.status(500).json({ success: false, message: 'Failed to start intelligent search' });
  }
}

export async function getAgentEvents(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 100;
    const status = req.query.status as string;
    let query = 'SELECT * FROM agent_events';
    const params: any[] = [];
    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching agent events:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
}

export async function getQualityMetrics(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await pool.query(
      'SELECT * FROM quality_metrics ORDER BY measured_at DESC LIMIT $1',
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching quality metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quality metrics' });
  }
}

export async function getAgentHealthSummary(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const agents = await pool.query('SELECT * FROM agent_states ORDER BY agent_name');
    const recentExecutions = await pool.query(`
      SELECT agent_name, status, COUNT(*) AS count, AVG(duration_ms)::int AS avg_ms
      FROM agent_executions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY agent_name, status
      ORDER BY agent_name
    `);
    const pendingEvents = await pool.query(
      "SELECT COUNT(*) AS count FROM agent_events WHERE status = 'pending'"
    );
    const totalMemory = await pool.query('SELECT COUNT(*) AS count FROM agent_memory');

    res.json({
      success: true,
      data: {
        agents: agents.rows,
        recent_executions: recentExecutions.rows,
        pending_events: parseInt(pendingEvents.rows[0].count),
        total_memories: parseInt(totalMemory.rows[0].count),
      }
    });
  } catch (error) {
    logger.error('Error fetching agent health:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch health summary' });
  }
}
