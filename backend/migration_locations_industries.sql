-- Migration: Add location and industry hierarchy tables
-- Run: psql -U leads -d leads -f backend/migration_locations_industries.sql

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES locations(id),
    country_code VARCHAR(10),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone VARCHAR(100),
    population INTEGER,
    gdp_usd DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_locations_id ON locations(id);
CREATE INDEX IF NOT EXISTS ix_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS ix_locations_type ON locations(location_type);
CREATE INDEX IF NOT EXISTS ix_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS ix_locations_country ON locations(country_code);
CREATE INDEX IF NOT EXISTS ix_locations_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS ix_locations_parent_type ON locations(parent_id, location_type);
CREATE INDEX IF NOT EXISTS ix_locations_country_slug ON locations(country_code, slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_slug_parent ON locations(slug, parent_id) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_slug_root ON locations(slug) WHERE parent_id IS NULL;

CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES industries(id),
    icon VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_industries_id ON industries(id);
CREATE INDEX IF NOT EXISTS ix_industries_slug ON industries(slug);
CREATE INDEX IF NOT EXISTS ix_industries_parent ON industries(parent_id);
CREATE INDEX IF NOT EXISTS ix_industries_active ON industries(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_industry_slug_parent ON industries(slug, parent_id) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_industry_slug_root ON industries(slug) WHERE parent_id IS NULL;
