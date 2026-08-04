# Lead Discovery Architecture

## Pipeline Flow
```
Discovery Campaign
  → Resolve locations × industries × providers
    → Search (19 free providers)
      → Deduplicate (name + website)
        → Scrape website details
          → Audit (17 checks + AI analysis)
            → Score (0-100 + opportunity score)
              → Research (social links, about page)
                → CRM (auto-create lead)
                  → Notify (dashboard)
```

## Components

### 1. Provider Registry (`worker/providers/`)
- Auto-discovery of all providers in package
- Base class with `search()`, `enrich()`, `health_check()`
- Rate limiting and error tracking per provider
- Admin enable/disable via DB config

### 2. Browser Abstraction (`worker/browser/`)
- `LightpandaBrowser` - Zig-based, fastest
- `PlaywrightBrowser` - Full JS rendering + screenshots
- `HTTPBrowser` - Lightweight fallback
- `BrowserPool` - Concurrent request management
- `BrowserManager` - Automatic fallback chain

### 3. Discovery Pipeline (`worker/services/discovery_pipeline.py`)
- 6-stage pipeline with configurable options
- Deduplication: none, basic, aggressive
- Website scraping for contact enrichment
- Contact validation and quality scoring
- AI-powered lead scoring

### 4. Campaign Orchestrator (`worker/tasks/campaign_orchestrator.py`)
- Locations × Industries × Providers matrix
- Auto-skip recent completed jobs (24h)
- Concurrency control
- Provider fallback on failure
- Auto-scheduler (every 5 min)

### 5. Provider Health (`worker/services/provider_orchestrator.py`)
- Success rate tracking per country
- Latency monitoring
- Auto-disable if <30% success rate
- Ranked provider selection

## Data Flow
```
SearchJob → SearchResult → Company → Audit → Score → Opportunity
                                    ↓
                              LeadPipeline → CRM
                                    ↓
                              Activities → Tasks
```

## Models
- `SearchJob` - Search request
- `SearchResult` - Individual result
- `Company` - Discovered business
- `Lead` - Qualified lead
- `LeadPipeline` - Pipeline stage
- `Opportunity` - Revenue opportunity
- `Proposal` - Sales proposal
- `ProviderMetrics` - Provider health
