# AI Lead Generation Platform - Agent Instructions

## Project Overview
This is a production-ready AI-powered Lead Generation Platform designed for the UAE market.

## Architecture

### Backend (Python/FastAPI)
- **Location**: `/backend/`
- **Framework**: FastAPI (async Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Queue**: Redis + Celery for background tasks
- **Storage**: MinIO for screenshots, logos, files
- **AI**: OpenAI, Gemini, Ollama (local) compatible APIs

### Frontend (Next.js)
- **Location**: `/frontend/`
- **Framework**: Next.js 16 with App Router
- **Styling**: TailwindCSS v4 + Shadcn/ui
- **Animations**: Framer Motion

### Browser Automation
- **Primary**: Lightpanda Browser (CDP/Playwright compatible)
- **Fallback**: Playwright
- **Features**: Multi-session, proxy rotation, rate limiting

## Key Files to Modify

### For Lead Management
- Backend CRUD: `/backend/src/database/queries.ts`
- Routes: `/backend/src/routes.ts`
- Controllers: `/backend/src/controllers/leadController.ts`

### For AI Agents
- All agents: `/backend/src/agents/`
- AI integration: `/backend/src/ai/integrations.ts`

### For UI
- Dashboard: `/frontend/src/components/dashboard/Dashboard.tsx`
- Leads list: `/frontend/src/app/leads/page.tsx`
- Company discovery: `/frontend/src/app/companies/page.tsx`
- Audit page: `/frontend/src/app/audit/page.tsx`

### For UAE Data
- Location templates are hardcoded in the company discovery page
- Dubai areas: Downtown Dubai, Business Bay, Dubai Marina, etc.
- Abu Dhabi areas: Al Reem Island, Yas Island, etc.
- Sharjah areas: Al Majaz, Al Nahda, etc.

## Environment Variables

Backend (.env):
```
DATABASE_URL=postgresql://user:password@localhost:5432/leads
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=minio
OPENAI_API_KEY=sk-xxx
OLLAMA_URL=http://localhost:11434
```

## Development Commands

Backend:
```bash
cd backend
npm run dev          # TypeScript dev server
npm run build        # Build TypeScript
npm run test         # Run tests
npm run lint         # Lint code
npm run typecheck    # TypeScript check
```

Frontend:
```bash
cd frontend
npm run dev          # Next.js dev server
npm run build        # Next.js production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

Docker:
```bash
# Build and run all services
docker compose up -d

# Run backend only
docker compose up -d backend

# Run frontend only
docker compose up -d frontend

# View logs
docker compose logs -f
```

## Extensibility
- All AI agents follow a common interface pattern
- New scrapers can be added to `/backend/src/agents/`
- New AI models can be configured via environment variables
- Location templates can be extended in the companies page
- Export formats are extensible through the export route