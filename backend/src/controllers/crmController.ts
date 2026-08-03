import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function getChangeHistory(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { entityType, entityId } = req.query;
    let query = 'SELECT * FROM change_history WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (entityType) { query += ` AND entity_type = $${idx++}`; params.push(entityType); }
    if (entityId) { query += ` AND entity_id = $${idx++}`; params.push(entityId); }

    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching change history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch change history' });
  }
}

export async function getLeadTimeline(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [activities, changes, tasks] = await Promise.all([
      pool.query(
        'SELECT *, \'activity\' as entry_type FROM activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50', [id]
      ),
      pool.query(
        `SELECT *, 'change' as entry_type FROM change_history
         WHERE entity_type = 'lead' AND entity_id = $1
         ORDER BY created_at DESC LIMIT 50`, [id]
      ),
      pool.query(
        'SELECT *, \'task\' as entry_type FROM lead_tasks WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50', [id]
      ),
    ]);

    const timeline = [...activities.rows, ...changes.rows, ...tasks.rows]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    res.json({ success: true, data: timeline });
  } catch (error) {
    logger.error('Error fetching timeline:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch timeline' });
  }
}

export async function getLeadTasks(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_tasks WHERE lead_id = $1 ORDER BY due_date ASC NULLS LAST', [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
}

export async function createLeadTask(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, description, priority = 'medium', due_date } = req.body;

    const result = await pool.query(
      `INSERT INTO lead_tasks (lead_id, title, description, priority, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, title, description, priority, due_date || null]
    );

    await pool.query(
      `INSERT INTO activities (lead_id, action, description) VALUES ($1, 'task_created', $2)`,
      [id, `Task created: ${title}`]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
}

export async function updateLeadTask(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { taskId } = req.params;
    const { status, title, description, priority, due_date } = req.body;

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) { sets.push(`status = $${idx++}`); values.push(status); }
    if (title) { sets.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }
    if (priority) { sets.push(`priority = $${idx++}`); values.push(priority); }
    if (due_date !== undefined) { sets.push(`due_date = $${idx++}`); values.push(due_date); }
    if (status === 'completed') { sets.push(`completed_at = NOW()`); }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }

    sets.push('updated_at = NOW()');
    values.push(taskId);

    const result = await pool.query(
      `UPDATE lead_tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
}

export async function addLeadNote(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { note } = req.body;

    await pool.query(
      `INSERT INTO activities (lead_id, action, description) VALUES ($1, 'note_added', $2)`,
      [id, note]
    );

    res.status(201).json({ success: true, message: 'Note added' });
  } catch (error) {
    logger.error('Error adding note:', error);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
}
