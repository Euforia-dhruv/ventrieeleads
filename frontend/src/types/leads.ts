export interface Lead {
  id: string;
  company_id: string;
  company_name: string;
  company_website: string;
  location: string;
  city: string;
  area: string;
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
  score: number;
  score_label: string;
  status: LeadStatus;
  source: string;
  rating: number;
  review_count: number;
  metadata: Record<string, unknown>;
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
  id: string;
  name: string;
  status: string;
  industry_filter: string[];
  location_filter: string[];
  lead_score_min: number;
  lead_score_max: number;
  created_at: string;
  updated_at: string;
}

export interface SearchJob {
  id: string;
  query: string;
  country: string;
  city: string;
  area: string;
  industry: string;
  keyword: string;
  max_results: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  results_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AuditReport {
  id?: string;
  website_id?: string;
  url?: string;
  website_score: number;
  seo_score: number;
  performance_score: number;
  accessibility_score: number;
  design_score: number;
  branding_score: number;
  conversion_score: number;
  copywriting_score: number;
  trust_score: number;
  overall_score: number;
  checks: Record<string, unknown>;
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  quick_wins: string[];
  estimated_redesign_budget: string;
  recommended_services: string[];
}

export interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  todayLeads: number;
  hotLeads: number;
  coldLeads: number;
  jobsRunning: number;
  jobsCompleted: number;
  avgLeadScore: number;
  byStatus: Record<string, number>;
  byIndustry: Record<string, number>;
  byCity: Record<string, number>;
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
