import { Pool } from 'pg';
import { logger } from '../core/logger';

export interface Lead {
  id: string;
  workspace_id: string;
  company_id: string;
  status: string;
  score: number;
  score_label: string;
  source: string;
  assigned_to: string | null;
  notes: string | null;
  is_deleted: boolean;
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
  lead_id: string;
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
  id: string;
  website_id: string;
  business_score: number;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  expected_roi: string;
  estimated_project_value: string;
  issues: any[];
  recommendations: any[];
  checks: Record<string, any>;
  created_at: Date;
}

export async function initializeDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info('Database connected - tables managed by init.sql');
  } finally {
    client.release();
  }
}
