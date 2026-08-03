-- Phase 2 Migration - Ventriee Leads
-- Adds new tables and extends existing ones for 15 modules

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================

-- Companies: add social + enrichment columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS twitter VARCHAR(500);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tiktok VARCHAR(500);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS snapchat VARCHAR(500);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_count INTEGER;

-- Websites: add missing social columns
ALTER TABLE websites ADD COLUMN IF NOT EXISTS tiktok VARCHAR(500);
ALTER TABLE websites ADD COLUMN IF NOT EXISTS about_content TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS terms_url TEXT;

-- Contacts: add enrichment metadata
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS seniority VARCHAR(50);

-- Campaigns: add workspace scope + description
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS notes TEXT;

-- Leads: add priority column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMP;

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Change History (Module 6): Track all field changes
CREATE TABLE IF NOT EXISTS change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_source VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled Searches (Module 4): Recurring search jobs
CREATE TABLE IF NOT EXISTS scheduled_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    query VARCHAR(500) NOT NULL,
    country VARCHAR(100) DEFAULT 'UAE',
    city VARCHAR(100),
    area VARCHAR(100),
    industry VARCHAR(100),
    keyword VARCHAR(255),
    min_rating DECIMAL(2,1),
    min_reviews INTEGER,
    max_results INTEGER DEFAULT 50,
    schedule_type VARCHAR(50) NOT NULL DEFAULT 'daily',
    cron_expression VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    total_runs INTEGER DEFAULT 0,
    last_results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Search Presets (Module 12): Built-in search templates
CREATE TABLE IF NOT EXISTS search_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    city VARCHAR(100),
    area VARCHAR(100),
    country VARCHAR(100) DEFAULT 'UAE',
    query_template VARCHAR(500),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_builtin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications (Module 13): System notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id),
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    entity_type VARCHAR(50),
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lead Tasks (Module 10): Tasks tied to leads
CREATE TABLE IF NOT EXISTS lead_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Leads (Module 11): Many-to-many
CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'added',
    notes TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

-- Opportunities (Module 9): Value estimates
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    website_redesign_min INTEGER DEFAULT 0,
    website_redesign_max INTEGER DEFAULT 0,
    seo_min INTEGER DEFAULT 0,
    seo_max INTEGER DEFAULT 0,
    branding_min INTEGER DEFAULT 0,
    branding_max INTEGER DEFAULT 0,
    performance_min INTEGER DEFAULT 0,
    performance_max INTEGER DEFAULT 0,
    booking_engine_min INTEGER DEFAULT 0,
    booking_engine_max INTEGER DEFAULT 0,
    ai_chatbot_min INTEGER DEFAULT 0,
    ai_chatbot_max INTEGER DEFAULT 0,
    analytics_min INTEGER DEFAULT 0,
    analytics_max INTEGER DEFAULT 0,
    maintenance_min INTEGER DEFAULT 0,
    maintenance_max INTEGER DEFAULT 0,
    total_min INTEGER DEFAULT 0,
    total_max INTEGER DEFAULT 0,
    confidence DECIMAL(3,2) DEFAULT 0,
    recommended_services JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin Settings (Module 15): Key-value store
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB DEFAULT '{}',
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Export History (Module 2): Track exports
CREATE TABLE IF NOT EXISTS export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id),
    format VARCHAR(50) NOT NULL,
    filters JSONB DEFAULT '{}',
    record_count INTEGER DEFAULT 0,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR NEW TABLES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_change_history_entity ON change_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_history_created ON change_history(created_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_searches_workspace ON scheduled_searches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_searches_active ON scheduled_searches(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_searches_next_run ON scheduled_searches(next_run_at);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead ON lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status ON lead_tasks(status);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_due ON lead_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_lead ON opportunities(lead_id);

CREATE INDEX IF NOT EXISTS idx_export_history_workspace ON export_history(workspace_id);

-- ============================================================
-- SEED DATA: Search Presets (Module 12)
-- ============================================================

INSERT INTO search_presets (name, slug, industry, city, country, query_template, icon, sort_order, is_builtin) VALUES
('Hotels Dubai', 'hotels-dubai', 'Hotels', 'Dubai', 'UAE', 'hotels Dubai UAE', 'hotel', 1, true),
('Hotels Abu Dhabi', 'hotels-abu-dhabi', 'Hotels', 'Abu Dhabi', 'UAE', 'hotels Abu Dhabi UAE', 'hotel', 2, true),
('Hotels Sharjah', 'hotels-sharjah', 'Hotels', 'Sharjah', 'UAE', 'hotels Sharjah UAE', 'hotel', 3, true),
('Restaurants Dubai', 'restaurants-dubai', 'Restaurants', 'Dubai', 'UAE', 'restaurants Dubai UAE', 'utensils', 4, true),
('Restaurants Business Bay', 'restaurants-business-bay', 'Restaurants', 'Dubai', 'UAE', 'restaurants Business Bay Dubai', 'utensils', 5, true),
('Clinics Dubai', 'clinics-dubai', 'Medical Clinics', 'Dubai', 'UAE', 'medical clinics Dubai UAE', 'stethoscope', 6, true),
('Dentists Dubai', 'dentists-dubai', 'Dentists', 'Dubai', 'UAE', 'dental clinics Dubai UAE', 'smile', 7, true),
('Law Firms Dubai', 'law-firms-dubai', 'Law Firms', 'Dubai', 'UAE', 'law firms Dubai UAE', 'scale', 8, true),
('Architects Dubai', 'architects-dubai', 'Architects', 'Dubai', 'UAE', 'architects Dubai UAE', 'drafting-compass', 9, true),
('Interior Designers Dubai', 'interior-designers-dubai', 'Interior Designers', 'Dubai', 'UAE', 'interior designers Dubai UAE', 'paintbrush', 10, true),
('Construction Companies Dubai', 'construction-dubai', 'Construction', 'Dubai', 'UAE', 'construction companies Dubai UAE', 'hammer', 11, true),
('Marketing Agencies UAE', 'marketing-agencies-uae', 'Marketing Agencies', 'Dubai', 'UAE', 'marketing agencies UAE', 'megaphone', 12, true),
('Real Estate Dubai', 'real-estate-dubai', 'Real Estate', 'Dubai', 'UAE', 'real estate companies Dubai UAE', 'building', 13, true),
('Gyms Dubai', 'gyms-dubai', 'Gyms', 'Dubai', 'UAE', 'gyms Dubai UAE', 'dumbbell', 14, true),
('Salons Dubai', 'salons-dubai', 'Salons', 'Dubai', 'UAE', 'salons Dubai UAE', 'scissors', 15, true),
('Car Rentals Dubai', 'car-rentals-dubai', 'Car Showrooms', 'Dubai', 'UAE', 'car rental companies Dubai UAE', 'car', 16, true),
('Luxury Brands Dubai', 'luxury-brands-dubai', 'Luxury Brands', 'Dubai', 'UAE', 'luxury brands Dubai UAE', 'crown', 17, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed default admin settings
INSERT INTO admin_settings (key, value, description, category) VALUES
('platform_name', '"Ventriee Leads"', 'Platform display name', 'general'),
('default_country', '"UAE"', 'Default country for searches', 'search'),
('max_concurrent_scrapes', '5', 'Max concurrent browser scrapes', 'workers'),
('enrichment_enabled', 'true', 'Enable auto-enrichment of contacts', 'enrichment'),
('duplicate_detection_enabled', 'true', 'Enable smart duplicate detection', 'dedup'),
('notification_enabled', 'true', 'Enable notifications', 'notifications'),
('rate_limit_per_minute', '60', 'API rate limit per minute', 'security')
ON CONFLICT (key) DO NOTHING;
