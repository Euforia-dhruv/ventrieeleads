# Ventriee Leads v3.0 — Release Notes

**Release Date:** August 3, 2026
**Codename:** Ship Mode

---

## What's New

### Authentication & Authorization
- JWT-based authentication with access + refresh tokens
- User registration, login, logout, password reset, magic links
- OAuth callback support
- Session management with device tracking
- Role-based access control (super_admin, admin, owner, member, viewer)
- Multi-workspace support with workspace isolation
- API key management for programmatic access

### Lead Management
- Full CRUD for leads with scoring (hot/warm/cold)
- Lead timeline tracking
- Lead tasks and notes (CRM)
- Lead pipeline with stage transitions
- Priority levels and follow-up scheduling
- Bulk export (CSV/JSON)
- Duplicate detection

### Company Intelligence
- Company profiles with website, contacts, technologies
- Automated website auditing (SEO, performance, accessibility, design, branding, conversion, copywriting, trust)
- Technology stack detection
- Competitor analysis
- Monitoring with scheduled checks and history
- Sales playbook generation

### AI Agent System
- 8 autonomous agents: Scout, Researcher, Auditor, Strategist, Content Writer, Manager, Monitor, Opportunity
- Agent health monitoring and execution history
- Quality metrics tracking
- Agent memory and event system
- Run-all orchestration

### Discovery Engine
- Multi-provider lead discovery (Google Maps, Clutch, GoodFirms, DesignRush, Dubai Directory, Yello UAE)
- Campaign-based discovery with job tracking
- Coverage analytics (by country, industry, provider)
- Provider health monitoring
- Cost tracking

### Intelligence Center
- Discovery intelligence dashboard
- Provider performance analytics
- Market intelligence
- Opportunity scoring
- Geographic heatmap
- Predictive discovery analytics
- Pipeline optimization
- Economics data
- Benchmark scores
- Executive reports

### AI Sales Pipeline
- Pipeline stages and overview
- Lead-level pipeline tracking
- Stage transitions

### Client Readiness & Negotiation
- Client readiness scoring (top prospects)
- AI negotiation profile generation

### Automation & Learning
- Automation rules with toggle control
- Execution history and stats
- Learning signal recording
- Performance metrics

### Content Generation
- AI copywriter
- Website redesign preview
- Proposal generation
- Executive briefings (morning briefing)

### Knowledge Graph
- Entity relationship visualization

### Admin Center
- System settings management
- User administration (roles, workspaces)
- Workspace management
- Provider configuration
- Queue status and worker monitoring
- Storage statistics
- Audit logs
- System metrics
- Database statistics
- Backup management
- Maintenance mode toggle

### Notifications
- Notification system with read/unread tracking
- Mark all as read
- Preference management

### Observability
- System overview (uptime, CPU, memory, disk)
- Metrics history
- Request tracing
- Prometheus metrics endpoint

### Scheduled Searches
- Create, update, delete scheduled searches
- Run-on-demand support

### Search Presets
- Save and manage search presets

### Export & Reporting
- Lead export (CSV/JSON)
- Export history
- Report generation and retrieval
- Change history tracking

### Frontend
- Full dashboard with real-time stats
- 30+ pages covering all features
- Dark mode support
- Responsive design
- Command palette (⌘K)

---

## Infrastructure

- **11 Docker containers:** nginx, frontend, backend, celery-beat, celery-worker, celery-research, celery-search, task-enqueuer, postgres, redis, minio
- **PostgreSQL 16** with 79 tables
- **Redis 7** for Celery queues and caching
- **MinIO** for object storage (screenshots, files)
- **Celery** with 3 worker types (general, search, research) + beat scheduler
- **nginx** reverse proxy with rate limiting and security headers
- **GitHub Actions** CI/CD pipeline

## API Performance
- Auth: ~1.8ms
- Leads list: ~16ms
- Companies: ~3.7ms
- Dashboard stats: ~122ms
- Average response: ~10ms

## Default Credentials
- **Admin:** admin@ventriee.com / admin123
- **MinIO:** minioadmin / minioadmin123
