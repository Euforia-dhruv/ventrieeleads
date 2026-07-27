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
  status: LeadStatus;
  source: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type LeadStatus =
  | 'New'
  | 'Qualified'
  | 'Researching'
  | 'Contacted'
  | 'Replied'
  | 'Meeting'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export interface Campaign {
  id: number;
  name: string;
  status: string;
  industry_filter: string[];
  location_filter: string[];
  lead_score_min: number;
  lead_score_max: number;
  created_at: string;
  updated_at: string;
}

export interface AuditReport {
  id?: number;
  lead_id?: number;
  url?: string;
  business_score: number;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  expected_roi?: string;
  estimated_project_value?: string;
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
  }>;
  recommendations: string[];
  checks: Record<string, boolean>;
}

export interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  todayLeads: number;
  emailsGenerated: number;
  outreachQueue: number;
  meetingsScheduled: number;
  revenuePipeline: number;
  hotLeads: number;
  coldLeads: number;
  byIndustry: Record<string, number>;
  byCity: Record<string, number>;
  byCountry: Record<string, number>;
  avgLeadScore: number;
}

export interface UAEArea {
  name: string;
  emirate: string;
  coordinates?: { lat: number; lng: number };
}

export interface UAEEmirate {
  name: string;
  areas: UAEArea[];
  industries: string[];
}
