# CLAUDE.md - Project Context

## What is this?
This is an AI Lead Generation Platform - an open-source alternative to Clay, Apollo, and Instantly designed for the UAE market. It uses Lightpanda Browser for automation, with Playwright as fallback.

## Domain Configuration
- **Production Domain**: https://ventrieeleads.qd.je (DigitalPlat FreeDomain)
- **API**: https://ventrieeleads.qd.je/api
- **Dashboard**: https://ventrieeleads.qd.je/dashboard
- **CORS**: Configured in backend `.env` and Docker environment
- **DNS**: Managed via DigitalPlat FreeDomain dashboard at https://domain.digitalplat.org
- **SSL**: Handled by Docker reverse proxy or CDN (Cloudflare free tier recommended)

## Key Technologies
- **Lightpanda** (primary browser) - lightweight, fast, CDP/Playwright compatible
- **Playwright** (fallback browser) - mature automation
- **FastAPI** (backend) - async Python REST API
- **Next.js** (frontend) - React with App Router
- **PostgreSQL** (database) - structured data storage
- **Redis** (queue) - Celery task queue + caching
- **MinIO** (storage) - object storage for screenshots/logos
- **Ollama** (local AI) - runs Llama, Qwen, DeepSeek locally
- **OpenAI API** (cloud AI) - GPT models when available
- **Gemini** (Google AI) - free tier available

## UAE Focus
The platform is built specifically for the UAE market with:
- Location templates for Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, UAQ, Al Ain
- 50+ Dubai areas including Downtown Dubai, Business Bay, Dubai Marina, JLT, etc.
- 50+ industries relevant to the UAE market
- Search examples pre-configured for common queries

## AI Agents
The system is agent-based with the following agents:
1. Scout Agent - finds companies via Google Maps and directories
2. Scraper Agent - extracts data from websites
3. Browser Agent - automated web interactions via Lightpanda
4. Research Agent - deep research on companies
5. Audit Agent - website analysis and scoring
6. Tech Stack Agent - technology detection
7. SEO Agent - search optimization analysis
8. Copywriting Agent - AI copy generation
9. Proposal Agent - professional proposal generation
10. Email Agent - email sequence creation
11. LinkedIn Agent - LinkedIn outreach automation
12. CRM Agent - lead management and pipeline
13. Analytics Agent - metrics and reporting

## Architecture Patterns
- Clean architecture with separation of concerns
- Modular agent system with plugin architecture
- Async/await throughout for high concurrency
- Rate limiting on all external API calls
- Retry logic for failed operations
- Proxy rotation support
- Deduplication on all data ingestion
- Comprehensive error handling

## Key Directories
- `/backend/src/core/` - Core utilities (logger, error handler)
- `/backend/src/browser/` - Browser automation layer (Lightpanda)
- `/backend/src/scrapers/` - Web scraping modules
- `/backend/src/ai/` - AI model integrations
- `/backend/src/agents/` - AI agent implementations
- `/backend/src/database/` - DB models, queries, connection
- `/backend/src/controllers/` - API route handlers
- `/frontend/src/components/` - React UI components
- `/frontend/src/app/` - Next.js pages and routes