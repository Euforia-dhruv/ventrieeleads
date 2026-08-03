-- Notification System Migration

BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, channel, event_type)
);
CREATE INDEX IF NOT EXISTS idx_np_user ON notification_preferences(user_id);

CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nc_user ON notification_channels(user_id);

CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nq_workspace ON notification_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_nq_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_nq_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_nq_scheduled ON notification_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_nq_channel ON notification_queue(channel);

-- Seed default notification preferences for common events
INSERT INTO notification_preferences (user_id, channel, event_type, is_enabled)
SELECT u.id, 'browser', 'lead.created', true FROM users u
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, channel, event_type, is_enabled)
SELECT u.id, 'browser', 'campaign.completed', true FROM users u
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, channel, event_type, is_enabled)
SELECT u.id, 'browser', 'agent.completed', true FROM users u
ON CONFLICT DO NOTHING;

COMMIT;
