import { Pool } from 'pg';
import { Lead } from './models';

export async function getLeads(pool: Pool, filters?: {
  status?: string;
  city?: string;
  industry?: string;
  minScore?: number;
  maxScore?: number;
  source?: string;
}): Promise<Lead[]> {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.city) {
      query += ` AND city = $${paramIndex}`;
      params.push(filters.city);
      paramIndex++;
    }

    if (filters?.industry) {
      query += ` AND industry = $${paramIndex}`;
      params.push(filters.industry);
      paramIndex++;
    }

    if (filters?.minScore !== undefined) {
      query += ` AND lead_score >= $${paramIndex}`;
      params.push(filters.minScore);
      paramIndex++;
    }

    if (filters?.maxScore !== undefined) {
      query += ` AND lead_score <= $${paramIndex}`;
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

export async function getLeadById(pool: Pool, id: number): Promise<Lead | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM leads WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createLead(pool: Pool, lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Promise<Lead> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO leads (
        company_name, company_website, location, city, country, industry,
        phone, email, address, description, logo_url, screenshot_url,
        tech_stack, seo_score, lead_score, status, source, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      lead.company_name, lead.company_website, lead.location, lead.city,
      lead.country, lead.industry, lead.phone, lead.email, lead.address,
      lead.description, lead.logo_url, lead.screenshot_url,
      lead.tech_stack, lead.seo_score, lead.lead_score, lead.status,
      lead.source, JSON.stringify(lead.metadata || {})
    ]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateLead(pool: Pool, id: number, updates: Partial<Lead>): Promise<Lead | null> {
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'company_name', 'company_website', 'location', 'city', 'country',
      'industry', 'phone', 'email', 'address', 'description',
      'logo_url', 'screenshot_url', 'tech_stack', 'seo_score', 'lead_score',
      'status', 'source', 'metadata'
    ];

    for (const field of allowedFields) {
      if (updates[field as keyof Lead] !== undefined) {
        sets.push(`${field} = $${paramIndex}`);
        values.push((updates as any)[field]);
        paramIndex++;
      }
    }

    if (sets.length === 0) {
      return getLeadById(pool, id);
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function deleteLead(pool: Pool, id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM leads WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  } finally {
    client.release();
  }
}

export async function getLeadStats(pool: Pool): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byIndustry: Record<string, number>;
  byCity: Record<string, number>;
  avgLeadScore: number;
}> {
  const client = await pool.connect();
  try {
    const total = await client.query('SELECT COUNT(*) FROM leads');
    const byStatus = await client.query('SELECT status, COUNT(*) as count FROM leads GROUP BY status');
    const byIndustry = await client.query('SELECT industry, COUNT(*) as count FROM leads GROUP BY industry');
    const byCity = await client.query('SELECT city, COUNT(*) as count FROM leads GROUP BY city ORDER BY count DESC LIMIT 20');
    const avgScore = await client.query('SELECT AVG(lead_score) as avg FROM leads');

    return {
      total: parseInt(total.rows[0].count),
      byStatus: Object.fromEntries(byStatus.rows.map((r: any) => [r.status, r.count])),
      byIndustry: Object.fromEntries(byIndustry.rows.map((r: any) => [r.industry, r.count])),
      byCity: Object.fromEntries(byCity.rows.map((r: any) => [r.city, r.count])),
      avgLeadScore: parseFloat(avg.rows[0].avg || '0')
    };
  } finally {
    client.release();
  }
}
