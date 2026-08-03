-- Authentication & Authorization System
-- Phase 1: Auth + Phase 2: RBAC + Phase 3: Workspaces + Phase 4: API Keys

BEGIN;

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    is_revoked BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE is_revoked = false;

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token_hash);

-- ============================================================
-- EMAIL VERIFICATION TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evt_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token_hash);

-- ============================================================
-- MAGIC LINK TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mlt_email ON magic_link_tokens(email);
CREATE INDEX IF NOT EXISTS idx_mlt_token ON magic_link_tokens(token_hash);

-- ============================================================
-- OAUTH CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    provider_name VARCHAR(255),
    provider_avatar TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_connections(provider, provider_user_id);

-- ============================================================
-- ROLES (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ROLE-PERMISSION MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- USER-WORKSPACE ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_workspace_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, workspace_id, role_id)
);

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'personal',
    scopes JSONB DEFAULT '["read"]',
    rate_limit INTEGER DEFAULT 100,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================
-- AUDIT LOG (for security events)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================
-- SEED ROLES
-- ============================================================
INSERT INTO roles (name, display_name, description, is_system) VALUES
    ('super_admin', 'Super Admin', 'Full system access', true),
    ('owner', 'Owner', 'Workspace owner with full control', true),
    ('admin', 'Admin', 'Administrative access', true),
    ('manager', 'Manager', 'Team management access', true),
    ('sales', 'Sales', 'Sales-focused access', true),
    ('researcher', 'Researcher', 'Research and analysis access', true),
    ('viewer', 'Viewer', 'Read-only access', true),
    ('support', 'Support', 'Customer support access', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, resource, action, description) VALUES
    -- Workspace
    ('workspace.read', 'workspace', 'read', 'View workspace details'),
    ('workspace.update', 'workspace', 'update', 'Update workspace settings'),
    ('workspace.delete', 'workspace', 'delete', 'Delete workspace'),
    ('workspace.manage_members', 'workspace', 'manage_members', 'Add/remove workspace members'),
    -- Campaign
    ('campaign.read', 'campaign', 'read', 'View campaigns'),
    ('campaign.create', 'campaign', 'create', 'Create campaigns'),
    ('campaign.update', 'campaign', 'update', 'Update campaigns'),
    ('campaign.delete', 'campaign', 'delete', 'Delete campaigns'),
    ('campaign.execute', 'campaign', 'execute', 'Execute/start campaigns'),
    -- Lead
    ('lead.read', 'lead', 'read', 'View leads'),
    ('lead.create', 'lead', 'create', 'Create leads'),
    ('lead.update', 'lead', 'update', 'Update leads'),
    ('lead.delete', 'lead', 'delete', 'Delete leads'),
    ('lead.export', 'lead', 'export', 'Export leads'),
    ('lead.bulk_action', 'lead', 'bulk_action', 'Bulk lead operations'),
    -- Company
    ('company.read', 'company', 'read', 'View companies'),
    ('company.create', 'company', 'create', 'Create companies'),
    ('company.update', 'company', 'update', 'Update companies'),
    ('company.delete', 'company', 'delete', 'Delete companies'),
    ('company.discover', 'company', 'discover', 'Run company discovery'),
    -- Proposal
    ('proposal.read', 'proposal', 'read', 'View proposals'),
    ('proposal.create', 'proposal', 'create', 'Create proposals'),
    ('proposal.update', 'proposal', 'update', 'Update proposals'),
    ('proposal.delete', 'proposal', 'delete', 'Delete proposals'),
    -- Report
    ('report.read', 'report', 'read', 'View reports'),
    ('report.create', 'report', 'create', 'Generate reports'),
    ('report.delete', 'report', 'delete', 'Delete reports'),
    -- Agent
    ('agent.read', 'agent', 'read', 'View agent status'),
    ('agent.execute', 'agent', 'execute', 'Execute agents'),
    ('agent.configure', 'agent', 'configure', 'Configure agents'),
    -- Settings
    ('settings.read', 'settings', 'read', 'View settings'),
    ('settings.update', 'settings', 'update', 'Update settings'),
    -- API Keys
    ('apikey.read', 'api_key', 'read', 'View API keys'),
    ('apikey.create', 'api_key', 'create', 'Create API keys'),
    ('apikey.delete', 'api_key', 'delete', 'Delete API keys'),
    -- Admin
    ('admin.access', 'admin', 'access', 'Access admin panel'),
    ('admin.manage_users', 'admin', 'manage_users', 'Manage all users'),
    ('admin.manage_workspaces', 'admin', 'manage_workspaces', 'Manage all workspaces'),
    ('admin.view_logs', 'admin', 'view_logs', 'View system logs'),
    ('admin.manage_providers', 'admin', 'manage_providers', 'Manage AI providers'),
    ('admin.manage_backups', 'admin', 'manage_backups', 'Manage backups')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED ROLE-PERMISSION MAPPINGS
-- ============================================================
-- Super Admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Owner gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Admin: everything except admin.access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name NOT LIKE 'admin.%'
ON CONFLICT DO NOTHING;

-- Manager: workspace + campaign + lead + company + proposal + report + agent.read + agent.execute
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager' AND (
    p.resource IN ('workspace', 'campaign', 'lead', 'company', 'proposal', 'report')
    OR (p.resource = 'agent' AND p.action IN ('read', 'execute'))
    OR (p.resource = 'settings' AND p.action = 'read')
)
ON CONFLICT DO NOTHING;

-- Sales: lead + company + campaign.read + proposal + report.read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'sales' AND (
    (p.resource IN ('lead', 'company') AND p.action != 'delete')
    OR (p.resource = 'campaign' AND p.action = 'read')
    OR (p.resource = 'proposal')
    OR (p.resource = 'report' AND p.action = 'read')
    OR (p.resource = 'agent' AND p.action = 'read')
)
ON CONFLICT DO NOTHING;

-- Researcher: lead.read + company.read + company.discover + agent.read + agent.execute + report.read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'researcher' AND (
    (p.resource = 'lead' AND p.action = 'read')
    OR (p.resource IN ('company', 'report') AND p.action IN ('read', 'discover'))
    OR (p.resource = 'agent' AND p.action IN ('read', 'execute'))
)
ON CONFLICT DO NOTHING;

-- Viewer: read-only on everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Support: lead.read + lead.update + company.read + campaign.read + report.read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'support' AND (
    (p.resource IN ('lead', 'company', 'campaign', 'report') AND p.action IN ('read', 'update'))
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATE USERS TABLE
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Seed default admin user (password: admin123 - bcrypt hash)
INSERT INTO users (email, name, hashed_password, role, workspace_id, is_active, email_verified)
SELECT 'admin@ventriee.com', 'Admin', '$2b$12$4IxzM1DtSUDz8vQZlYoBj.vEVkUlL4.xGnIS7AKR/3b0pK/FR9TpO', 'super_admin', w.id, true, true
FROM workspaces w WHERE w.slug = 'default'
ON CONFLICT (email) DO NOTHING;

COMMIT;
