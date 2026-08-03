# Architecture Overview

## System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          NGINX (Reverse Proxy)                       │
│                    Rate Limiting · SSL Termination                    │
└──────────┬────────────────────────────────────┬──────────────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────────────┐
│   Frontend (Next.js)│            │      Backend (Express.js)        │
│    Port 3000        │            │         Port 8000                │
│                     │            │                                  │
│  React 19 + RSC     │─────API───│  REST API + WebSocket Server     │
│  TailwindCSS v4     │            │                                  │
│  Shadcn/ui          │            │  Auth · Leads · Campaigns        │
│  Framer Motion      │            │  Search · Agents · Admin         │
└─────────────────────┘            └────────┬────────────────────────┘
                                            │
              ┌─────────────────────────────┼────────────────────────┐
              │                             │                        │
              ▼                             ▼                        ▼
┌──────────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│   PostgreSQL 16      │  │      Redis 7             │  │    MinIO          │
│   Primary Database   │  │  Cache · Queue · Session  │  │  Object Storage   │
│                      │  │                           │  │                   │
│  users, leads,       │  │  Celery broker            │  │  screenshots/     │
│  campaigns, audit    │  │  Rate limit counters      │  │  logos/            │
│  reports, sessions   │  │  WebSocket pub/sub        │  │  files/            │
└──────────────────────┘  └──────────┬─────────────────┘  └──────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────────┐
              │                      │                          │
              ▼                      ▼                          ▼
┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Task Enqueuer      │  │  Celery Workers       │  │  Celery Beat         │
│  (Python) :8002     │  │  (Python)             │  │  (Scheduler)         │
│                     │  │                       │  │                      │
│  REST → Redis Queue │  │  scrape · audit       │  │  Cron-like tasks     │
│                     │  │  search · research    │  │  Health checks       │
│                     │  │  process · agents     │  │  Daily reports       │
└─────────────────────┘  └───────────────────────┘  └──────────────────────┘
```

## Backend Architecture (Express.js)

### Entry Point (`backend/src/index.ts`)

The Express server initializes in this order:

1. **Helmet** — Security headers (`X-Frame-Options`, `CSP`, etc.)
2. **CORS** — Configured origins, credentials, allowed headers
3. **Rate Limiters** — General (100/min), search (10/min), audit (5/min)
4. **Compression** — gzip/deflate response compression
5. **Body Parsing** — JSON (5MB limit), URL-encoded (5MB limit)
6. **Security Middleware** — XSS headers, SQL injection protection, request sanitization
7. **Observability Middleware** — OpenTelemetry-style tracing, request metrics
8. **Request Logging** — Request ID generation, duration tracking, slow request warnings
9. **Health Check** — `GET /health` (database, Redis, WebSocket status)
10. **API Routes** — All `/api/*` routes
11. **Prometheus Metrics** — `GET /metrics`
12. **Error Handler** — Global error handler
13. **WebSocket** — `ws://host/ws` endpoint
14. **Server Start** — PostgreSQL, Redis, MinIO initialization

### Middleware Stack

| Middleware | Source | Purpose |
|-----------|--------|---------|
| `helmet` | npm | Security headers |
| `cors` | npm | Cross-origin resource sharing |
| `express-rate-limit` | npm | Rate limiting |
| `compression` | npm | Response compression |
| `securityMiddleware` | `middleware/security.ts` | Combined XSS/CSP/SQLi/sanitization |
| `tracingMiddleware` | `middleware/observability.ts` | OpenTelemetry-style span tracing |
| `requestMetricsMiddleware` | `middleware/observability.ts` | Prometheus metric collection |
| `authenticate` | `middleware/auth.ts` | JWT + session validation |
| `requireRole` | `middleware/auth.ts` | Role-based access control |
| `csrfProtection` | `middleware/security.ts` | CSRF token validation |
| `fileUploadValidation` | `middleware/security.ts` | Upload type/size validation |
| `inputLengthValidation` | `middleware/security.ts` | Field length limits |
| `ipFilter` | `middleware/security.ts` | IP allowlist/blocklist |

### Route Structure (`backend/src/routes.ts`)

Routes are organized into functional groups:

```
/api
├── /health                          (public)
├── /auth/*                          (public + authenticated)
├── /api-keys/*                      (authenticated)
├── /dashboard/*                     (authenticated)
├── /search/*                        (authenticated)
├── /leads/*                         (authenticated)
├── /campaigns/*                     (authenticated)
├── /companies/*                     (authenticated)
├── /export/*                        (authenticated)
├── /scheduled-searches/*            (authenticated)
├── /notifications/*                 (authenticated)
├── /presets/*                        (authenticated)
├── /opportunities/*                 (authenticated)
├── /admin/*                         (admin + super_admin)
├── /providers/*                     (authenticated)
├── /reports/*                       (authenticated)
├── /proposals/*                     (authenticated)
├── /copywriter                      (authenticated)
├── /redesign                        (authenticated)
├── /agents/*                        (authenticated)
├── /knowledge                       (authenticated)
├── /briefings/*                     (authenticated)
├── /locations/*                     (authenticated)
├── /industries/*                    (authenticated)
├── /discovery-campaigns/*           (authenticated)
├── /discovery/*                     (authenticated)
├── /intelligence-center/*           (authenticated)
├── /pipeline/*                      (authenticated)
├── /readiness/*                     (authenticated)
├── /negotiation/*                   (authenticated)
├── /learning/*                      (authenticated)
├── /automation/*                    (authenticated)
├── /improvement/*                   (authenticated)
├── /executive/*                     (authenticated)
└── /observability/*                 (authenticated)
```

### Controllers

| Controller | Responsibility |
|-----------|---------------|
| `authController` | Registration, login, logout, password reset, magic link, OAuth, sessions |
| `leadController` | Lead CRUD, stats, filtering |
| `campaignController` | Campaign CRUD, lead-campaign associations |
| `searchController` | Search job creation, status, cancellation |
| `companyController` | Company detail, contacts, technologies, audit, enrichment |
| `exportController` | Lead export (CSV/Excel), export history |
| `scheduledSearchController` | Scheduled search CRUD, manual trigger |
| `crmController` | Change history, lead timeline, tasks, notes |
| `notificationController` | Notification list, read/delete |
| `presetController` | Search preset CRUD |
| `adminController` | Settings, worker status |
| `adminCenterController` | Users, workspaces, providers, queues, storage, backups, metrics, DB stats, maintenance |
| `opportunityController` | Opportunity details, estimation |
| `researchController` | Provider list, research triggers, competitor analysis |
| `monitoringController` | Monitoring schedule, manual checks, history |
| `reportController` | Report listing, generation, retrieval |
| `platformController` | Proposals, copywriter, redesign, company timeline, sales playbook, executive stats |
| `agentController` | Agent listing, execution, memory, knowledge graph, briefings |
| `locationIndustryController` | Location/industry hierarchy CRUD |
| `campaignOrchestratorController` | Discovery campaigns, coverage, health, costs |
| `intelligenceCenterController` | Intelligence reports, heatmap, predictive, economics, benchmarks |
| `modulesController` | Pipeline, readiness, negotiation, automation, learning, observability |
| `apiKeyController` | API key CRUD |
| `monitoringController` | Company monitoring |

### Services

| Service | File | Purpose |
|---------|------|---------|
| `AuditLogService` | `services/auditLogService.ts` | Audit log creation and querying |
| `BackupService` | `services/backupService.ts` | Database backup creation |
| `NotificationService` | `services/notificationService.ts` | In-app notification management |

## Frontend Architecture (Next.js)

### Directory Structure

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── admin/page.tsx
│   ├── agents/page.tsx
│   ├── automation/page.tsx
│   ├── benchmarks/page.tsx
│   ├── briefing/page.tsx
│   ├── companies/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── competitors/page.tsx
│   ├── copywriter/page.tsx
│   ├── discovery/
│   │   ├── page.tsx
│   │   └── health/page.tsx
│   ├── executive/
│   │   ├── page.tsx
│   │   └── ai/page.tsx
│   ├── export/page.tsx
│   ├── heatmap/page.tsx
│   ├── insights/page.tsx
│   ├── intelligence/
│   │   ├── page.tsx
│   │   └── center/page.tsx
│   ├── jobs/page.tsx
│   ├── knowledge/page.tsx
│   ├── leads/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── locations/page.tsx
│   ├── industries/page.tsx
│   ├── monitoring/page.tsx
│   ├── notifications/page.tsx
│   ├── observability/page.tsx
│   ├── pipeline/page.tsx
│   ├── playbook/page.tsx
│   ├── presets/page.tsx
│   ├── proposals/page.tsx
│   ├── prospects/page.tsx
│   ├── redesign/page.tsx
│   ├── reports/page.tsx
│   ├── scheduled/page.tsx
│   ├── search/page.tsx
│   ├── settings/page.tsx
│   └── page.tsx (Dashboard)
├── components/ (Shadcn/ui + custom)
├── lib/
│   ├── utils.ts
│   └── constants.ts
```

### Tech Stack

- **React 19** with React Server Components (RSC)
- **Next.js 16** App Router
- **TailwindCSS v4** for styling
- **Shadcn/ui** component library
- **Framer Motion** for animations

### Key Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview stats, recent activity |
| Leads | `/leads` | Lead list with filters |
| Lead Detail | `/leads/[id]` | Individual lead view |
| Campaigns | `/campaigns` | Campaign management |
| Search | `/search` | Lead search interface |
| Companies | `/companies` | Company directory |
| Company Detail | `/companies/[id]` | Company profile |
| Audit | `/audit` | Website audit reports |
| Discovery | `/discovery` | Company discovery campaigns |
| Intelligence Center | `/intelligence-center` | Analytics dashboard |
| Pipeline | `/pipeline` | Sales pipeline |
| Agents | `/agents` | AI agent management |
| Admin | `/admin` | System administration |
| Settings | `/settings` | User/workspace settings |

## Python Worker Architecture (Celery)

### Celery Application (`backend/worker/celery_app.py`)

- **Broker**: Redis
- **Backend**: Redis
- **Serialization**: JSON
- **Task acknowledgment**: Late (tasks requeued on worker crash)
- **Soft time limit**: 300s per task
- **Hard time limit**: 600s per task
- **Max tasks per child**: 100 (worker restarts after 100 tasks)

### Task Queues

| Queue | Workers | Purpose |
|-------|---------|---------|
| `scrape` | celery-worker (4 concurrency) | Web scraping, screenshots |
| `audit` | celery-worker (4 concurrency) | Website audits |
| `process` | celery-worker (4 concurrency) | Data processing, CRM, agents |
| `search` | celery-search (2 concurrency) | Lead search, intelligence |
| `research` | celery-research (2 concurrency) | AI research, competitor analysis |

### Celery Beat Schedule

| Task | Interval | Description |
|------|----------|-------------|
| `cleanup_stale_jobs` | 5 min | Clean stuck search jobs |
| `run_scheduled_checks` | 10 min | Run monitoring checks |
| `health_check` | 5 min | Agent health checks |
| `recover_failures` | 10 min | Recover failed agent runs |
| `run_all_agents` | 30 min | Execute all agents |
| `generate_briefing` | Daily | Executive briefing |
| `update_campaign_progress` | 1 min | Campaign progress tracking |
| `generate_executive_report` | Daily | Intelligence report |
| `compute_opportunity_scores` | 12 hours | Score opportunities |
| `refresh_benchmarks` | Daily | Refresh benchmarks |
| `compute_all_readiness_scores` | 12 hours | Client readiness scores |
| `generate_negotiation_profiles` | Daily | Negotiation profiles |
| `nightly_improvement_report` | 2:00 AM | Improvement reports |
| `morning_executive_briefing` | 7:00 AM | Morning briefing |
| `collect_system_metrics` | 5 min | System metrics |

### Agent Framework (`backend/worker/agents/base.py`)

Every agent inherits from `BaseAgent` and gets:

- **Memory** — Store/recall/contextual queries with expiration
- **Goals** — Define and track objectives
- **Confidence scoring** — Weighted multi-factor confidence calculation
- **Reasoning** — Explain decisions in plain text
- **Execution history** — Full audit trail of all runs
- **Retry logic** — Automatic error recovery
- **Event publishing** — Inter-agent communication
- **Quality tracking** — Self-improvement metrics

### Agent List

| Agent | File | Description |
|-------|------|-------------|
| Scout | `agents/scout.py` | Lead discovery from directories |
| Researcher | `agents/researcher.py` | Company research and intelligence |
| Auditor | `agents/auditor.py` | Website audits and scoring |
| Content Writer | `agents/content_writer.py` | Copy generation |
| Manager | `agents/manager.py` | Agent coordination |
| Strategist | `agents/strategist.py` | Sales strategy |
| Monitor | `agents/monitor.py` | Company monitoring |
| Opportunity | `agents/opportunity.py` | Opportunity assessment |

### Scrapers (`backend/worker/scrapers/`)

| Scraper | Description |
|---------|-------------|
| `google_maps.py` | Google Maps Places API |
| `website.py` | Website content extraction |
| `screenshot.py` | Page screenshot capture |
| `tech_detector.py` | Technology stack detection |

### Providers (`backend/worker/providers/`)

| Provider | Description |
|----------|-------------|
| `google_maps.py` | Google Maps API |
| `clutch.py` | Clutch.co directory |
| `goodfirms.py` | GoodFirms directory |
| `designrush.py` | DesignRush directory |
| `yello_uae.py` | Yello UAE directory |
| `dubai_directory.py` | Dubai business directory |
| `registry.py` | Provider registry/factory |

### TypeScript Agents (`backend/src/agents/`)

| Agent | File | Description |
|-------|------|-------------|
| ScoutAgent | `scoutAgent.ts` | Google Maps search (TypeScript side) |
| AuditAgent | `auditAgent.ts` | Website audit tasks |
| EmailAgent | `emailAgent.ts` | Email generation |
| CopywritingAgent | `copywritingAgent.ts` | Copy generation |
| ResearchAgent | `researchAgent.ts` | Research tasks |
| ProposalAgent | `proposalAgent.ts` | Proposal generation |

## Database Schema Overview

### Core Tables (PostgreSQL)

```
users
├── id (UUID, PK)
├── email (unique)
├── name
├── hashed_password
├── role (owner | super_admin | admin | member | viewer)
├── workspace_id (FK → workspaces)
├── is_active
├── is_deleted
├── email_verified
├── avatar_url
├── last_login_at
├── login_count
├── created_at, updated_at

workspaces
├── id (UUID, PK)
├── name
├── slug (unique)
├── plan
├── created_at, updated_at

sessions
├── id (UUID, PK)
├── user_id (FK → users)
├── token_hash
├── refresh_token_hash
├── user_agent
├── ip_address
├── device_name
├── device_type
├── is_revoked
├── expires_at
├── refresh_expires_at
├── created_at, last_accessed_at

leads
├── id (UUID, PK)
├── workspace_id (FK → workspaces)
├── company_id
├── status (new | contacted | qualified | proposal | negotiation | won | lost)
├── score (0-100)
├── score_label
├── source
├── assigned_to
├── notes
├── is_deleted
├── created_at, updated_at

campaigns
├── id (SERIAL, PK)
├── name
├── status (active | paused | completed)
├── industry_filter (JSONB)
├── location_filter (JSONB)
├── lead_score_min, lead_score_max
├── created_at, updated_at

email_sequences
├── id (SERIAL, PK)
├── lead_id (FK → leads)
├── campaign_id (FK → campaigns)
├── subject, body
├── status
├── sent_at, opened_at, replied_at
├── created_at

audit_reports
├── id (UUID, PK)
├── website_id
├── business_score, website_score, seo_score, conversion_score
├── expected_roi, estimated_project_value
├── issues (JSONB)
├── recommendations (JSONB)
├── checks (JSONB)
├── created_at

api_keys
├── id (UUID, PK)
├── user_id (FK → users)
├── key_prefix
├── key_hash
├── workspace_id (FK → workspaces)
├── name
├── permissions (JSONB)
├── is_active
├── last_used_at
├── expires_at
├── created_at

password_reset_tokens
email_verification_tokens
magic_link_tokens
oauth_connections

agent_states
agent_executions
agent_memories
agent_events
knowledge_edges
quality_metrics
```

### Python Worker Tables (SQLAlchemy)

```
AgentState — Agent status, goals, confidence, run statistics
AgentExecution — Full execution history with input/output
AgentMemory — Agent long-term memory with expiration
AgentEvent — Inter-agent event bus
KnowledgeEdge — Knowledge graph relationships
QualityMetric — Agent quality tracking
```

## WebSocket Architecture

### Connection (`backend/src/core/websocket.ts`)

- **Endpoint**: `ws://host/ws?token=<jwt>` or `ws://host/ws` (anonymous)
- **Protocol**: JSON messages
- **Heartbeat**: 30s ping/pong
- **Authentication**: JWT via query param or `Authorization` header

### Message Types

**Client → Server:**
```json
{ "type": "subscribe", "channel": "leads" }
{ "type": "unsubscribe", "channel": "leads" }
{ "type": "ping" }
```

**Server → Client:**
```json
{ "type": "connected", "data": { "userId": "...", "workspaceId": "..." } }
{ "type": "subscribed", "channel": "leads" }
{ "type": "broadcast", "channel": "leads", "data": {...}, "timestamp": 1234567890 }
{ "type": "message", "channel": "leads", "data": {...}, "timestamp": 1234567890 }
{ "type": "pong", "timestamp": 1234567890 }
{ "type": "error", "data": { "message": "..." } }
```

### Broadcasting

- `broadcast(workspaceId, channel, data)` — Send to all subscribers in a workspace
- `broadcastToAll(channel, data)` — Send to all connected clients
- `sendToUser(userId, channel, data)` — Send to specific user

## Authentication Flow

### JWT Tokens

- **Access token**: 7-day expiry, contains `{id, email, role, workspace_id}`
- **Refresh token**: 30-day expiry, contains `{id, type: 'refresh'}`
- **Remember me**: Extends to 90 days (access) / 180 days (refresh)
- **Signing**: HMAC-SHA256 with `JWT_SECRET`

### Session Management

1. On login/register, tokens are hashed (SHA-256) and stored in `sessions` table
2. Session includes device info, IP, user agent, expiry timestamps
3. Revoked tokens are stored in Redis for 7 days (`revoked:<token>`)
4. On logout, session is marked as revoked in DB and Redis
5. Password change/logout-all revokes all active sessions

### Authentication Methods

1. **Email/Password** — bcrypt hashed passwords (12 rounds)
2. **Magic Link** — Token emailed, 15-minute expiry, one-time use
3. **OAuth** — Google/GitHub callback creates or links account
4. **API Key** — `X-API-Key` header, bcrypt-hashed keys, optional expiry

## Authorization Flow

### Roles

| Role | Description |
|------|-------------|
| `owner` | Workspace creator, full access |
| `super_admin` | Platform-wide admin |
| `admin` | Workspace admin |
| `member` | Standard user |
| `viewer` | Read-only access |

### Role-Based Access Control

```typescript
// Middleware
router.use(authenticate);                    // All routes below require auth
router.get('/admin/*', requireRole('super_admin', 'admin'), handler);  // Admin only
```

### Permission-Based Access Control

```typescript
// For fine-grained permissions
requirePermission('leads.create')
// Checks user_workspace_roles → role_permissions → permissions table
// super_admin and owner bypass all permission checks
```

## API Structure

### Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "message": "Error description" }

// With pagination
{ "success": true, "data": [...], "total": 100, "page": 1, "limit": 20 }
```

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | `Bearer <jwt_token>` |
| `X-API-Key` | Alternative | API key for service auth |
| `X-Request-ID` | Auto | Generated if missing |
| `X-Trace-ID` | Optional | Distributed tracing |
| `Content-Type` | Yes | `application/json` |

### Rate Limits

| Scope | Window | Limit |
|-------|--------|-------|
| General | 1 min | 100 requests |
| Search | 1 min | 10 requests |
| Audit | 1 min | 5 requests |
| Nginx general | 1 sec | 20 req/s (burst 10) |
| Nginx search | 1 sec | 5 req/s (burst 5) |
| Nginx audit | 1 sec | 2 req/s (burst 3) |
