# Development Guide

## Local Development Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 16
- Redis 7
- MinIO (optional for local dev)

### Quick Start

```bash
# Clone repository
git clone <repo-url> leads
cd leads

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install Python worker dependencies
cd ../backend && pip install -r requirements.txt

# Start development servers
cd backend && npm run dev    # Express on :8000
cd frontend && npm run dev  # Next.js on :3000
```

### Docker Development

```bash
# Start all services
docker compose up -d

# Rebuild specific service
docker compose up -d --build backend

# View logs
docker compose logs -f backend
```

### Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Frontend
cp frontend/.env.example frontend/.env.local
```

## Project Structure

```
leads/
├── backend/
│   ├── src/                          # TypeScript source
│   │   ├── index.ts                  # Entry point
│   │   ├── routes.ts                 # Route definitions
│   │   ├── agents/                   # TypeScript AI agents
│   │   │   ├── scoutAgent.ts
│   │   │   ├── auditAgent.ts
│   │   │   ├── emailAgent.ts
│   │   │   ├── copywritingAgent.ts
│   │   │   ├── researchAgent.ts
│   │   │   └── proposalAgent.ts
│   │   ├── ai/
│   │   │   └── integrations.ts       # AI provider clients
│   │   ├── core/
│   │   │   ├── errorHandler.ts
│   │   │   ├── logger.ts
│   │   │   └── websocket.ts
│   │   ├── controllers/              # Route handlers
│   │   │   ├── authController.ts
│   │   │   ├── leadController.ts
│   │   │   ├── campaignController.ts
│   │   │   └── ... (20+ controllers)
│   │   ├── database/
│   │   │   ├── connection.ts         # PostgreSQL pool
│   │   │   ├── redis.ts              # Redis client
│   │   │   ├── minio.ts              # MinIO client
│   │   │   ├── models.ts             # TypeScript interfaces
│   │   │   └── queries.ts            # Database queries
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT + API key auth
│   │   │   ├── security.ts           # XSS, SQLi, CSRF
│   │   │   └── observability.ts      # Tracing, metrics
│   │   ├── browser/
│   │   │   └── lightpanda.ts         # Browser automation
│   │   └── services/
│   │       ├── auditLogService.ts
│   │       ├── backupService.ts
│   │       └── notificationService.ts
│   ├── worker/                       # Python Celery workers
│   │   ├── celery_app.py
│   │   ├── agents/                   # Python AI agents
│   │   │   ├── base.py               # BaseAgent framework
│   │   │   ├── scout.py
│   │   │   ├── researcher.py
│   │   │   ├── auditor.py
│   │   │   ├── content_writer.py
│   │   │   ├── manager.py
│   │   │   ├── strategist.py
│   │   │   ├── monitor.py
│   │   │   └── opportunity.py
│   │   ├── scrapers/
│   │   │   ├── google_maps.py
│   │   │   ├── website.py
│   │   │   ├── screenshot.py
│   │   │   └── tech_detector.py
│   │   ├── providers/
│   │   │   ├── base.py
│   │   │   ├── google_maps.py
│   │   │   ├── clutch.py
│   │   │   ├── goodfirms.py
│   │   │   ├── designrush.py
│   │   │   ├── yello_uae.py
│   │   │   ├── dubai_directory.py
│   │   │   └── registry.py
│   │   ├── services/
│   │   │   ├── ai_client.py
│   │   │   ├── audit.py
│   │   │   ├── scoring.py
│   │   │   ├── intelligence.py
│   │   │   ├── negotiation.py
│   │   │   ├── client_readiness.py
│   │   │   ├── discovery_optimizer.py
│   │   │   ├── pipeline_learning_automation.py
│   │   │   └── provider_orchestrator.py
│   │   ├── tasks/
│   │   │   ├── search.py
│   │   │   ├── scrape.py
│   │   │   ├── audit.py
│   │   │   ├── process.py
│   │   │   ├── research.py
│   │   │   ├── monitor.py
│   │   │   ├── agents.py
│   │   │   ├── intelligence.py
│   │   │   ├── campaign_orchestrator.py
│   │   │   ├── intelligence_analytics.py
│   │   │   └── modules.py
│   │   ├── models/
│   │   │   └── database.py           # SQLAlchemy models
│   │   └── utils/
│   ├── tests/
│   │   ├── auth.test.ts
│   │   ├── leads.test.ts
│   │   ├── routes.test.ts
│   │   └── errorHandler.test.ts
│   ├── init.sql                      # Database schema
│   ├── Dockerfile.typescript
│   └── Dockerfile.python
├── frontend/
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (auth)/               # Auth pages (login, register)
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── leads/page.tsx
│   │   │   ├── campaigns/page.tsx
│   │   │   └── ... (40+ pages)
│   │   ├── components/
│   │   └── lib/
│   │       ├── utils.ts
│   │       └── constants.ts
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── scripts/
├── tests/
├── docker-compose.yml
└── docs/
```

## Adding New Routes

### Step 1: Create Controller

Create `backend/src/controllers/myController.ts`:

```typescript
import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../core/logger';

export async function listItems(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM items WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('List items error:', error);
    res.status(500).json({ success: false, message: 'Failed to list items' });
  }
}

export async function createItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO items (name, description, workspace_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.workspaceId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Create item error:', error);
    res.status(500).json({ success: false, message: 'Failed to create item' });
  }
}
```

### Step 2: Register Routes

Add to `backend/src/routes.ts`:

```typescript
import { listItems, createItem } from './controllers/myController';

// Inside setupRoutes():
router.route('/items').get(listItems).post(createItem);
```

### Step 3: Add Database Table

Add to `backend/init.sql`:

```sql
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_items_workspace ON items(workspace_id);
```

### Step 4: Add Frontend Page

Create `frontend/src/app/items/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function ItemsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => setItems(data.data));
  }, []);

  return (
    <div>
      <h1>Items</h1>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

## Adding New Controllers

### Pattern

1. Create controller file in `backend/src/controllers/`
2. Import dependencies (`getPool`, `AuthRequest`, `logger`)
3. Export async functions matching route handler signature `(req: AuthRequest, res: Response) => Promise<void>`
4. Use `req.workspaceId` for workspace-scoped queries
5. Return `{ success: true, data: ... }` for success
6. Return `{ success: false, message: '...' }` for errors
7. Log errors with `logger.error()`

### Validation Pattern

```typescript
export async function createItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      res.status(400).json({ success: false, message: 'Name and email are required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email format' });
      return;
    }

    // Validate length
    if (name.length > 255) {
      res.status(400).json({ success: false, message: 'Name too long' });
      return;
    }

    // Proceed with database operation...
  } catch (error) {
    logger.error('Create item error:', error);
    res.status(500).json({ success: false, message: 'Failed to create item' });
  }
}
```

### Pagination Pattern

```typescript
export async function listItems(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const pool = getPool();
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM items WHERE workspace_id = $1',
      [req.workspaceId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM items WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.workspaceId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total,
      page,
      limit
    });
  } catch (error) {
    logger.error('List items error:', error);
    res.status(500).json({ success: false, message: 'Failed to list items' });
  }
}
```

## Adding New Pages

### Page Types

1. **Static Page**: `'use client'` directive, no server-side data
2. **Server Component**: Default, fetches data on server
3. **Dynamic Route**: `[id]/page.tsx` for entity detail pages

### Example: List Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        setItems(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Items</h1>
      <div className="grid gap-4">
        {items.map(item => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Example: Detail Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function ItemDetailPage() {
  const params = useParams();
  const [item, setItem] = useState(null);

  useEffect(() => {
    fetch(`/api/items/${params.id}`)
      .then(res => res.json())
      .then(data => setItem(data.data));
  }, [params.id]);

  if (!item) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{item.name}</h1>
      <p>{item.description}</p>
    </div>
  );
}
```

## Testing Guide

### Backend Tests (Jest)

```bash
# Run all tests
cd backend && npm test

# Run specific test file
npm test -- auth.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Structure

```typescript
// backend/tests/auth.test.ts
import request from 'supertest';
import express from 'express';

describe('Auth API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Setup routes...
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Another User',
          password: 'password123'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });
});
```

### Python Tests (pytest)

```bash
# Run all tests
cd backend && pytest

# Run specific test file
pytest tests/test_leads.py

# Run with coverage
pytest --cov=worker

# Run with verbose output
pytest -v
```

### Integration Tests

```bash
# Run integration tests
cd tests && pytest test_integration.py

# These require running services (docker compose up)
```

## Linting and Formatting

### TypeScript

```bash
# Lint
cd backend && npm run lint

# Type check
npm run typecheck

# Fix lint issues
npm run lint -- --fix
```

### Python

```bash
# Lint with ruff
cd backend && ruff check worker/

# Format with ruff
ruff format worker/

# Type check with mypy
mypy worker/
```

### Frontend

```bash
cd frontend && npm run lint
npm run typecheck
```

## Git Workflow

### Branch Naming

```
feature/lead-scoring-v2
bugfix/login-redirect
hotfix/security-patch
release/v1.2.0
```

### Commit Messages

```
feat: add lead scoring algorithm
fix: resolve login redirect loop
refactor: extract audit logic to service
docs: update API documentation
test: add auth controller tests
chore: update dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run lint and type checks
4. Push and create PR
5. Request review
6. Merge after approval

### Release Process

```bash
# Update version
npm version minor

# Create release branch
git checkout -b release/v1.2.0

# Test thoroughly
docker compose up -d
# Run full test suite

# Merge to main
git checkout main
git merge release/v1.2.0

# Tag release
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Deploy
git push origin main
```

### Pre-commit Checks

```bash
# Add to .git/hooks/pre-commit
#!/bin/sh
cd backend && npm run lint && npm run typecheck
cd ../frontend && npm run lint && npm run typecheck
```
