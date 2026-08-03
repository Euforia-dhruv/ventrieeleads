-- Phase 6: Autonomous AI Agents System
-- Run: psql -U leads -d leads < phase6_migration.sql

BEGIN;

-- Agent state tracking
CREATE TABLE IF NOT EXISTS agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'idle',
  goals JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0.0,
  reasoning TEXT,
  last_run_at TIMESTAMP,
  next_scheduled_run_at TIMESTAMP,
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent execution history
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  trigger_type VARCHAR(50) DEFAULT 'scheduled',
  trigger_data JSONB DEFAULT '{}',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  reasoning TEXT,
  confidence FLOAT DEFAULT 0.0,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Agent memory for persistent learning
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  content TEXT NOT NULL,
  embedding_vector JSONB,
  confidence FLOAT DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id, relationship)
);

-- Agent events for inter-agent communication
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  source_agent VARCHAR(100),
  target_agent VARCHAR(100),
  payload JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Executive insights (daily briefings)
CREATE TABLE IF NOT EXISTS executive_briefings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  briefing_date DATE NOT NULL,
  briefing_type VARCHAR(50) DEFAULT 'morning',
  top_opportunities JSONB DEFAULT '[]',
  website_changes JSONB DEFAULT '[]',
  highest_value_prospects JSONB DEFAULT '[]',
  growing_industries JSONB DEFAULT '[]',
  active_cities JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  summary TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(briefing_date, briefing_type)
);

-- Self-improvement tracking
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  metric_name VARCHAR(200) NOT NULL,
  metric_value FLOAT NOT NULL,
  baseline_value FLOAT,
  metadata JSONB DEFAULT '{}',
  measured_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for agent tables
CREATE INDEX IF NOT EXISTS idx_agent_states_name ON agent_states(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_executions_name ON agent_executions(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created ON agent_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_name ON agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(agent_name, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_entity ON agent_memory(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON knowledge_edges(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relationship ON knowledge_edges(relationship);
CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_events_status ON agent_events(status);
CREATE INDEX IF NOT EXISTS idx_agent_events_target ON agent_events(target_agent);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_date ON executive_briefings(briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_type ON quality_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_name ON quality_metrics(metric_name);

-- Seed agent states for all 8 agents
INSERT INTO agent_states (agent_name, status, config) VALUES
  ('scout', 'idle', '{"industries": ["Real Estate", "Technology", "Healthcare", "Finance", "Education", "Hospitality", "Retail", "Manufacturing", "Construction", "Automotive", "Food & Beverage", "Fashion", "Beauty & Wellness", "Travel & Tourism"], "cities": ["Dubai", "Abu Dhabi", "Sharjah"], "max_per_run": 50, "providers": ["google_maps"]}'),
  ('researcher', 'idle', '{"auto_research": true, "max_per_run": 20, "min_confidence": 0.5}'),
  ('auditor', 'idle', '{"auto_audit": true, "max_per_run": 20, "re_audit_after_hours": 72}'),
  ('opportunity', 'idle', '{"min_score": 40, "max_per_run": 50, "re_score_interval_hours": 24}'),
  ('strategist', 'idle', '{"auto_strategize": true, "max_per_run": 20, "min_opportunity_score": 50}'),
  ('content_writer', 'idle', '{"auto_generate": true, "max_per_run": 10, "types": ["proposal", "cold_email", "linkedin", "whatsapp"]}'),
  ('monitor', 'idle', '{"check_interval_hours": 24, "alert_threshold": 5, "auto_trigger_research": true}'),
  ('manager', 'idle', '{"coordinate_all": true, "max_concurrent": 5, "retry_failed": true}')
ON CONFLICT (agent_name) DO NOTHING;

COMMIT;
