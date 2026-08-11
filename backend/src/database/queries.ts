import { Pool } from 'pg';
import { Lead } from './models';

export async function getLeads(
  pool: Pool,
  filters?: {
    status?: string;
    city?: string;
    industry?: string;
    minScore?: number;
    maxScore?: number;
    source?: string;
  },
): Promise<Lead[]> {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM leads WHERE is_deleted = false';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.city) {
      query += ` AND company_id IN (SELECT id FROM companies WHERE city = $${paramIndex})`;
      params.push(filters.city);
      paramIndex++;
    }

    if (filters?.industry) {
      query += ` AND company_id IN (SELECT id FROM companies WHERE industry = $${paramIndex})`;
      params.push(filters.industry);
      paramIndex++;
    }

    if (filters?.minScore !== undefined) {
      query += ` AND score >= $${paramIndex}`;
      params.push(filters.minScore);
      paramIndex++;
    }

    if (filters?.maxScore !== undefined) {
      query += ` AND score <= $${paramIndex}`;
      params.push(filters.maxScore);
      paramIndex++;
    }

    if (filters?.source) {
      query += ` AND source = $${paramIndex}`;
      params.push(filters.source);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getLeadById(pool: Pool, id: string): Promise<Lead | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM leads WHERE id = $1 AND is_deleted = false', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getLeadStats(pool: Pool): Promise<{
  total: number;
  byStatus: Record<string, number>;
  avgScore: number;
}> {
  const client = await pool.connect();
  try {
    const total = await client.query('SELECT COUNT(*) FROM leads WHERE is_deleted = false');
    const byStatus = await client.query(
      'SELECT status, COUNT(*) as count FROM leads WHERE is_deleted = false GROUP BY status',
    );
    const avgScore = await client.query('SELECT AVG(score) as avg FROM leads WHERE is_deleted = false');

    return {
      total: parseInt(total.rows[0].count),
      byStatus: Object.fromEntries(byStatus.rows.map((r: any) => [r.status, parseInt(r.count)])),
      avgScore: parseFloat(avgScore.rows[0].avg || '0'),
    };
  } finally {
    client.release();
  }
}
