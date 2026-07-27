import { Pool } from 'pg';
import { logger } from '../core/logger';

export interface Lead {
  id: number;
  company_name: string;
  company_website: string;
  location: string;
  city: string;
  country: string;
  industry: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  logo_url: string;
  screenshot_url: string;
  tech_stack: string[];
  seo_score: number;
  lead_score: number;
  status: string;
  source: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Campaign {
  id: number;
  name: string;
  status: string;
  industry_filter: string[];
  location_filter: string[];
  lead_score_min: number;
  lead_score_max: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmailSequence {
  id: number;
  lead_id: number;
  campaign_id: number;
  subject: string;
  body: string;
  status: string;
  sent_at: Date | null;
  opened_at: Date | null;
  replied_at: Date | null;
  created_at: Date;
}

export interface AuditReport {
  id: number;
  lead_id: number;
  business_score: number;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  expected_roi: string;
  estimated_project_value: string;
  issues: string[];
  recommendations: string[];
  created_at: Date;
}

export async function initializeDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        company_website VARCHAR(500),
        location VARCHAR(255),
        city VARCHAR(100),
        country VARCHAR(100),
        industry VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        description TEXT,
        logo_url TEXT,
        screenshot_url TEXT,
        tech_stack TEXT[] DEFAULT '{}',
        seo_score INTEGER DEFAULT 0,
        lead_score INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'New',
        source VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        industry_filter TEXT[] DEFAULT '{}',
        location_filter TEXT[] DEFAULT '{}',
        lead_score_min INTEGER DEFAULT 0,
        lead_score_max INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_sequences (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id),
        campaign_id INTEGER REFERENCES campaigns(id),
        subject VARCHAR(500),
        body TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        replied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id),
        business_score INTEGER DEFAULT 0,
        website_score INTEGER DEFAULT 0,
        seo_score INTEGER DEFAULT 0,
        conversion_score INTEGER DEFAULT 0,
        expected_roi VARCHAR(100),
        estimated_project_value VARCHAR(100),
        issues TEXT[] DEFAULT '{}',
        recommendations TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score)
    `);

    logger.info('Database tables initialized successfully');
  } finally {
    client.release();
  }
}
