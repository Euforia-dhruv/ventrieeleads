-- Performance & index migration
-- Adds missing indexes used by deduplication and lead lookups.
-- CREATE INDEX IF NOT EXISTS makes this safe to run repeatedly.

CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies(phone);
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_google_maps_url ON companies(google_maps_url);
CREATE INDEX IF NOT EXISTS idx_companies_provider_slug ON companies(provider_slug);

-- Search results: fastest lookup of a job's rows (already filtered in queries).
CREATE INDEX IF NOT EXISTS idx_search_results_job_dup ON search_results(search_job_id, is_duplicate);
CREATE INDEX IF NOT EXISTS idx_search_results_company ON search_results(company_id);

-- Search jobs listing + status filtering
CREATE INDEX IF NOT EXISTS idx_search_jobs_status_created ON search_jobs(status, created_at DESC);