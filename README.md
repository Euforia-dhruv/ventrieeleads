# AI Lead Generation Platform

An open-source, production-ready AI-powered Lead Generation OS for building sales pipelines from scratch, designed to rival commercial platforms like Clay, Apollo, and Instantly while using free/open-source technologies.

## Overview

This platform is a modular, scalable, and agent-based system capable of:
- Finding businesses (Google Maps, Company Directories)
- Analyzing and qualifying them
- Generating personalized outreach
- Managing the sales pipeline
- All from the UAE with focus on Dubai, Abu Dhabi, and Sharjah

## Tech Stack

### Backend (TypeScript + Python)
- **Python FastAPI**: REST API framework
- **PostgreSQL with SQLAlchemy**: Database
- **Redis**: Queue management and caching
- **Celery**: Task queue for background processing
- **MinIO**: Object storage for screenshots, logos, etc.
- **Ollama/OpenAI/Gemini**: AI models (local or cloud)

### Frontend (Next.js)
- **Next.js**: React framework
- **TailwindCSS**: CSS framework
- **Shadcn/ui**: UI component library
- **Framer Motion**: Animations

### Browser Automation
- **Lightpanda Browser**: Lightweight, fast automation (CDP compatible)
- **Playwright**: Fallback browser automation
- **BeautifulSoup**: Web scraping
- **Requests**: HTTP client

### AI Agents
- Modular agent system for different tasks
- Plugin architecture for extensibility

### UAE Focus
- Built-in location templates for all UAE emirates
- Dubai-specific areas (Downtown Dubai, Business Bay, Dubai Marina, etc.)
- Industry classifications tailored for UAE market

## Access

- **Live URL**: https://ventrieeleads.qd.je
- **Backend API**: https://ventrieeleads.qd.je/api
- **Dashboard**: https://ventrieeleads.qd.je/dashboard

## Domain Setup

This project uses the **DigitalPlat FreeDomain** `ventrieeleads.qd.je`.

### DNS Records

| Type | Name | Value |
| ---- | ---- | ----- |
| A    | @    | YOUR_SERVER_IP |
| A    | www  | YOUR_SERVER_IP |
| CNAME| api  | ventrieeleads.qd.je |

### SSL Certificates

Place at: `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem`.

Or use Let's Encrypt via the nginx container.

### Deploy

```bash
docker compose up -d
```

## Local Development

### Prerequisites
- Node.js (>=18)
- Python 3.9+
- PostgreSQL
- Redis
- Docker (optional but recommended)

### Step 1: Set up environment files

Create `.env` files in respective directories:

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/leads
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
OPENAI_API_KEY=sk-your-key
OLLAMA_URL=http://localhost:11434
GEMINI_API_KEY=your-gemini-key
LIGHTPANDA_PATH=/path/to/lightpanda
```

### Step 2: Initialize databases

```bash
# PostgreSQL
createdb leads

# Redis (start with default config)
redis-server

# MinIO (create buckets)
minio server --address :9000 data/
```

### Step 3: Install dependencies

```bash
# Backend
cd backend
cp requirements.txt /tmp/requirements.txt && pip install -r /tmp/requirements.txt
cp package.json /tmp/package.json && npm install

# Frontend
cd frontend
npm install
```

### Step 4: Run services

```bash
# Backend
cd backend
# Start Redis and PostgreSQL first
fastapi dev main.py

# Frontend
cd frontend
npm run dev
```

## Directory Structure

```
/leads
├── backend/
│   ├── agents/                    # AI Agent implementations
│   │   ├── scout/                # Scout Agent - finds leads
│   │   ├── scraper/              # Scraper Agent - extracts data
│   │   ├── browser/              # Browser Agent - automation
│   │   ├── research/             # Research Agent - company research
│   │   ├── audit/                # Audit Agent - website analysis
│   │   └── ...                   # More agents
│   ├── core/                      # Core modules
│   │   ├── browser/               # Browser automation core
│   │   ├── scrapers/              # Universal scrapers
│   │   ├── ai/                   # AI integrations
│   │   ├── database/             # Database models and services
│   │   ├── config/               # Configuration
│   │   └── utils/                # Common utilities
│   ├── services/                  # Business logic services
│   ├── docker/                   # Docker configurations
│   └── tests/                     # Unit and integration tests
├── frontend/                      # Next.js frontend
│   ├── public/                   # Static assets
│   ├── src/                      # Source code
│   │   ├── app/                  # Next.js pages
│   │   ├── components/           # UI components
│   │   ├── services/             # API services
│   │   ├── stores/               # Zustand stores
│   │   └── hooks/                # Custom hooks
│   ├── scripts/                  # Build scripts
│   └── styles/                    # Global styles
├── docs/                          # Documentation
├── scripts/                       # Automation scripts
└── tests/                        # Test suites
```

## Features

### Company Discovery
- Google Maps scraping with location targeting
- Dubai Business Directory integration
- Yellow Pages UAE
- Clutch, Contra, PeoplePerHour
- Yello UAE
- Company website enumeration

### Tech Detection
- BuiltWith API integration
- Wappalyzer for tech stack detection
- Lightpanda CDP extraction

### Email Enrichment
- Hunter Free API integration
- Apollo Free API
- Company website email extraction
- WHOIS and DNS lookups

### Social Discovery
- LinkedIn Company Pages
- Instagram business scraping
- Facebook Company Pages
- Twitter/X scraping
- YouTube channel data

### AI-powered Analysis
- Website screenshot generation
- Logo extraction and storage
- Color palette extraction
- Font detection
- Technology detection
- SEO audit
- Performance audit
- Accessibility audit
- AI copy analysis
- AI design analysis
- Lead scoring

### CRM and Pipeline
- Lead Status tracking (New, Qualified, Contacted, etc.)
- Follow-up scheduling
- Proposal generation
- Email generation
- Pipeline management

### Exporting
- CSV export
- Excel export (with formulas)
- JSON export
- PDF export (reports)
- Markdown export (analysis)

### Dashboard
- Today's Leads
- Qualified Leads
- Emails Generated
- Outreach Queue
- Meetings scheduled
- Revenue Pipeline
- Hot/Cold Leads
- Industry analytics
- City/Country analytics

## AI Agents

### Scout Agent
- Searches Google Maps for businesses
- Filters by location and industry
- Deduplicates results
- Prioritizes based on lead score

### Scraper Agent
- Extracts business data from discovered sources
- Collects contact information
- Gathers company details
- Handles rate limiting and retries

### Browser Agent
- Automated web interactions
- Login handling
- Data extraction from dynamic sites
- Multi-session support with Lightpanda

### Research Agent
- Deep research on discovered leads
- Company background analysis
- Competitor research
- Market analysis

### Audit Agent
- Website health checks
- SEO analysis
- Performance audits
- Security checks
- Accessibility testing

### Tech Stack Agent
- Technology detection
- Framework identification
- Stack analysis
- Version detection

### SEO Agent
- Keyword analysis
- On-page optimization
- Backlink profiling
- Competitor SEO analysis

### Copywriting Agent
- Email copy generation
- Proposal writing
- Follow-up messages
- Personalization

### Proposal Agent
- Professional proposal templates
- Pricing calculations
- Service descriptions
- PDF generation

### Email Agent
- Email sequence creation
- Personalization tokens
- A/B testing optimization
- Delivery scheduling

### LinkedIn Agent
- LinkedIn outreach automation
- Connection requests
- Message sending
- Profile research

### CRM Agent
- Lead qualification
- Pipeline management
- Task scheduling
- Follow-up reminders

### Analytics Agent
- Performance metrics
- Lead conversion tracking
- Revenue forecasting
- Dashboard data aggregation

## UAE Market Focus

### Emirates
- Abu Dhabi
- Dubai (with detailed areas)
- Sharjah (with detailed areas)
- Ajman
- Ras Al Khaimah
- Fujairah
- Umm Al Quwain
- Al Ain

### Dubai Areas (50+)
- Downtown Dubai, Business Bay, Dubai Marina
- Jumeirah, Palm Jumeirah, Deira
- JLT, Al Barsha, Silicon Oasis
- Design District, Media City, Healthcare City
- And 40+ more areas

### Industries (50+)
- Hotels, Restaurants, Cafes
- Medical Clinics, Hospitals, Dentists
- Real Estate, Construction
- Interior Designers, Architects
- Gyms, Salons, Spas
- Car Showrooms, Law Firms
- IT Companies, Marketing Agencies
- Education, Schools, Universities
- And 30+ more industries

### Search Examples
```
Hotels Dubai Marina
Luxury Hotels Downtown Dubai
Restaurants Business Bay
Dental Clinic Dubai
Gym JLT
Construction Company Abu Dhabi
Interior Designer Dubai
Architect Sharjah
Salon Al Barsha
Real Estate Palm Jumeirah
```

## AI Audit Reports

Automatically detect and score:
- Old website
- Broken images
- Slow loading
- Missing SSL
- No WhatsApp
- Poor SEO
- No Analytics
- No Meta Pixel
- Weak branding
- No CTA
- Bad mobile experience
- No booking engine
- Poor accessibility

Generate scores and reports:
- Business Score (0-100)
- Website Score (0-100)
- SEO Score (0-100)
- Conversion Score (0-100)
- Expected ROI
- Estimated Project Value

## CRM Lead Status

1. **New**: Just discovered
2. **Qualified**: Passed basic criteria
3. **Researching**: Deep analysis in progress
4. **Contacted**: Reached out
5. **Replied**: Got a response
6. **Meeting**: Scheduled or completed
7. **Proposal**: Sent proposal
8. **Negotiation**: In discussion
9. **Won**: Converted
10. **Lost**: Not interested

## Exports

- **CSV**: Simple data export
- **Excel**: With formulas and formatting
- **JSON**: API-ready format
- **PDF**: Professional reports
- **Markdown**: Analysis documentation

## Dashboard Analytics

Track:
- Today's Leads
- Qualified Leads
- Emails Generated
- Outreach Queue
- Meetings
- Revenue Pipeline
- Hot Leads (>80% score)
- Cold Leads (<30% score)
- By Industry
- By City
- By Country

## Development

### Code Quality
- TypeScript for type safety
- ESLint for linting
- Prettier for formatting
- Husky for pre-commit hooks
- All code is tested and linted

### Testing
- Unit tests with Jest
- Integration tests
- E2E tests with Playwright
- Load testing for scale

### Performance
- Async/await everywhere
- Optimized for thousands of concurrent jobs
- Retry logic for failed operations
- Proxy rotation support
- Rate limiting
- Deduplication

### Security
- Environment variables
- Rate limiting
- Input validation
- HTTPS enforcement
- Secure headers

### Docker
- Docker support for easy deployment
- Redis, PostgreSQL, MinIO as services
- Multi-stage builds for small footprint
- Health checks and monitoring

## Contributing

1. Fork the repository
2. Create your feature branch
3. Implement with tests
4. Follow code style
5. Submit a PR

## License

MIT
