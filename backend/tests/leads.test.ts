import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.BCRYPT_ROUNDS = '4';
process.env.NODE_ENV = 'test';

const JWT_SECRET = 'test-secret-for-ci';

const mockQuery = jest.fn();
const mockRedisGet = jest.fn().mockResolvedValue(null);

jest.mock('../src/database/connection', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery
  }))
}));

jest.mock('../src/database/redis', () => ({
  redisClient: {
    getClient: jest.fn(() => ({
      get: mockRedisGet,
      setEx: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK')
    }))
  }
}));

jest.mock('../src/core/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { getPool } from '../src/database/connection';
import { redisClient } from '../src/database/redis';
import {
  listLeads, getLead, addLead, updateLeadHandler, deleteLeadHandler, leadStats
} from '../src/controllers/leadController';
import { authenticate } from '../src/middleware/auth';

function createTestToken(payload: jwt.JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function getMockPool() {
  return (getPool as jest.Mock)();
}

function makeAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

const AUTH_TOKEN = createTestToken({
  id: 'user-123',
  email: 'test@example.com',
  role: 'owner',
  workspace_id: 'ws-123'
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
});

function setupAuthMocks(userId = 'user-123') {
  mockRedisGet.mockResolvedValue(null);
  mockQuery.mockResolvedValueOnce({
    rows: [{
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      workspace_id: 'ws-123',
      email_verified: true,
      is_active: true
    }]
  });
}

function createAuthenticatedApp(
  method: 'get' | 'post' | 'put' | 'delete',
  routePath: string,
  handler: any,
  useMiddleware = true
) {
  const app = express();
  app.use(express.json());
  if (useMiddleware) {
    app[method](routePath, authenticate, handler);
  } else {
    app[method](routePath, handler);
  }
  return app;
}

describe('Lead Controller - List Leads', () => {
  it('should list leads with default pagination', async () => {
    const pool = getMockPool();
    const mockLeads = [
      { id: 'lead-1', company_name: 'Company A', status: 'New', score: 85 },
      { id: 'lead-2', company_name: 'Company B', status: 'Qualified', score: 72 }
    ];

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: mockLeads });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(50);
    expect(res.body.pagination.total).toBe(2);
  });

  it('should filter leads by status', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', status: 'Qualified' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .query({ status: 'Qualified' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('l.status = $1'),
      expect.arrayContaining(['Qualified'])
    );
  });

  it('should filter leads by city', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', city: 'Dubai' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ city: 'Dubai' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('c.city = $1'),
      expect.arrayContaining(['Dubai'])
    );
  });

  it('should filter leads by industry', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', industry: 'Hotels' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ industry: 'Hotels' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('c.industry = $1'),
      expect.arrayContaining(['Hotels'])
    );
  });

  it('should filter leads by score range', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', score: 85 }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ minScore: '70', maxScore: '100' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('l.score >= $1'),
      expect.arrayContaining([70])
    );
  });

  it('should search leads by company name', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', company_name: 'Acme Corp' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ search: 'Acme' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining(['%Acme%'])
    );
  });

  it('should handle custom pagination', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '25' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .query({ page: '2', limit: '10' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('should handle smart filters (hasWebsite, hasEmail)', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ hasWebsite: 'true', hasEmail: 'false' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("c.website IS NOT NULL AND c.website != ''"),
      expect.any(Array)
    );
  });

  it('should handle opportunity filters (noSSL, noWhatsApp)', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ noSSL: 'true', noWhatsApp: 'true' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ssl' = 'false'"),
      expect.any(Array)
    );
  });

  it('should handle sorting options', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ sortBy: 'score', sortOrder: 'ASC' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY l.score ASC'),
      expect.any(Array)
    );
  });

  it('should handle database errors', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Lead Controller - Get Lead', () => {
  it('should get a single lead by ID', async () => {
    const pool = getMockPool();
    const mockLead = {
      id: 'lead-123',
      company_name: 'Acme Corp',
      status: 'New',
      score: 85,
      company_id: 'company-1'
    };

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [mockLead] })
      .mockResolvedValueOnce({ rows: [{ name: 'React', category: 'Frontend' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('get', '/leads/:id', getLead);

    const res = await request(app)
      .get('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('lead-123');
    expect(res.body.data.technologies).toBeDefined();
    expect(res.body.data.audit).toBeDefined();
    expect(res.body.data.activities).toBeDefined();
  });

  it('should return 404 for non-existent lead', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('get', '/leads/:id', getLead);

    const res = await request(app)
      .get('/leads/non-existent')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not found');
  });

  it('should include technologies from database', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', company_id: 'company-1' }] })
      .mockResolvedValueOnce({
        rows: [
          { name: 'React', category: 'Frontend', version: '18.0', confidence: 0.95 },
          { name: 'Node.js', category: 'Backend', version: '20.0', confidence: 0.90 }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('get', '/leads/:id', getLead);

    const res = await request(app)
      .get('/leads/lead-1')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.body.data.technologies).toHaveLength(2);
    expect(res.body.data.technologies[0].name).toBe('React');
  });

  it('should handle database errors', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = createAuthenticatedApp('get', '/leads/:id', getLead);

    const res = await request(app)
      .get('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Lead Controller - Create Lead', () => {
  it('should create a new lead with valid data', async () => {
    const pool = getMockPool();
    const mockCompany = { id: 'company-new' };
    const mockLead = {
      id: 'lead-new',
      workspace_id: 'ws-123',
      company_id: 'company-new',
      status: 'New',
      source: 'manual'
    };

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [mockCompany] })
      .mockResolvedValueOnce({ rows: [mockLead] });

    const app = createAuthenticatedApp('post', '/leads', addLead);

    const res = await request(app)
      .post('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({
        company_name: 'New Company',
        company_website: 'https://example.com',
        city: 'Dubai',
        country: 'UAE',
        industry: 'Hotels',
        phone: '+971-50-123-4567',
        email: 'info@example.com',
        address: 'Dubai Marina',
        status: 'New',
        source: 'manual'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('lead-new');
  });

  it('should create lead with default values', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'company-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1', status: 'New', source: 'manual' }] });

    const app = createAuthenticatedApp('post', '/leads', addLead);

    const res = await request(app)
      .post('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ company_name: 'Minimal Company' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('New');
    expect(res.body.data.source).toBe('manual');
  });

  it('should handle database errors during creation', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = createAuthenticatedApp('post', '/leads', addLead);

    const res = await request(app)
      .post('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ company_name: 'Failed Company' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Lead Controller - Update Lead', () => {
  it('should update lead status', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'lead-123', status: 'Qualified', updated_at: new Date() }]
    });

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    const res = await request(app)
      .put('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ status: 'Qualified' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Qualified');
  });

  it('should update lead score', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'lead-123', score: 95 }]
    });

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    const res = await request(app)
      .put('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ score: 95 });

    expect(res.status).toBe(200);
    expect(res.body.data.score).toBe(95);
  });

  it('should update lead priority and notes', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'lead-123', priority: 'high', notes: 'Important lead' }]
    });

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    const res = await request(app)
      .put('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ priority: 'high', notes: 'Important lead' });

    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.notes).toBe('Important lead');
  });

  it('should reject update with no valid fields', async () => {
    setupAuthMocks();

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    const res = await request(app)
      .put('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ invalid_field: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No valid fields');
  });

  it('should return 404 for non-existent lead', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    const res = await request(app)
      .put('/leads/non-existent')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ status: 'Qualified' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should add updated_at timestamp', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'lead-123', status: 'Contacted' }]
    });

    const app = createAuthenticatedApp('put', '/leads/:id', updateLeadHandler);

    await request(app)
      .put('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN))
      .send({ status: 'Contacted' });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('updated_at = NOW()'),
      expect.any(Array)
    );
  });
});

describe('Lead Controller - Delete Lead', () => {
  it('should soft delete a lead', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'lead-123' }] });

    const app = createAuthenticatedApp('delete', '/leads/:id', deleteLeadHandler);

    const res = await request(app)
      .delete('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(true);
  });

  it('should set is_deleted flag', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'lead-123' }] });

    const app = createAuthenticatedApp('delete', '/leads/:id', deleteLeadHandler);

    await request(app)
      .delete('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('is_deleted = true'),
      ['lead-123']
    );
  });

  it('should return 404 for non-existent lead', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('delete', '/leads/:id', deleteLeadHandler);

    const res = await request(app)
      .delete('/leads/non-existent')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not found');
  });

  it('should handle database errors during deletion', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = createAuthenticatedApp('delete', '/leads/:id', deleteLeadHandler);

    const res = await request(app)
      .delete('/leads/lead-123')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Lead Controller - Dashboard Stats', () => {
  it('should return lead statistics', async () => {
    const pool = getMockPool();
    setupAuthMocks();

    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '150' }] })
      .mockResolvedValueOnce({
        rows: [
          { status: 'New', count: '50' },
          { status: 'Qualified', count: '30' },
          { status: 'Contacted', count: '20' }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { industry: 'Hotels', count: '40' },
          { industry: 'Restaurants', count: '25' }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { city: 'Dubai', count: '80' },
          { city: 'Abu Dhabi', count: '30' }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ avg: '72.5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '12' }] })
      .mockResolvedValueOnce({ rows: [{ count: '45' }] })
      .mockResolvedValueOnce({ rows: [{ count: '20' }] })
      .mockResolvedValueOnce({ rows: [{ count: '60' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '25' }] });

    const app = createAuthenticatedApp('get', '/dashboard/stats', leadStats);

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalLeads).toBe(150);
    expect(res.body.data.todayLeads).toBe(12);
    expect(res.body.data.hotLeads).toBe(45);
    expect(res.body.data.coldLeads).toBe(20);
    expect(res.body.data.qualifiedLeads).toBe(60);
    expect(res.body.data.jobsRunning).toBe(3);
    expect(res.body.data.jobsCompleted).toBe(25);
    expect(res.body.data.avgLeadScore).toBe(72.5);
    expect(res.body.data.byStatus).toBeDefined();
    expect(res.body.data.byIndustry).toBeDefined();
    expect(res.body.data.byCity).toBeDefined();
  });

  it('should handle empty database gracefully', async () => {
    const pool = getMockPool();
    setupAuthMocks();

    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ avg: null }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const app = createAuthenticatedApp('get', '/dashboard/stats', leadStats);

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.data.totalLeads).toBe(0);
    expect(res.body.data.avgLeadScore).toBe(0);
  });

  it('should compute status counts correctly', async () => {
    const pool = getMockPool();
    setupAuthMocks();

    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '100' }] })
      .mockResolvedValueOnce({
        rows: [
          { status: 'New', count: '30' },
          { status: 'Qualified', count: '25' },
          { status: 'Contacted', count: '20' },
          { status: 'Replied', count: '10' },
          { status: 'Meeting', count: '8' },
          { status: 'Proposal', count: '5' },
          { status: 'Won', count: '2' }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ avg: '65' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '30' }] })
      .mockResolvedValueOnce({ rows: [{ count: '15' }] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '18' }] });

    const app = createAuthenticatedApp('get', '/dashboard/stats', leadStats);

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.body.data.byStatus.New).toBe(30);
    expect(res.body.data.byStatus.Qualified).toBe(25);
    expect(res.body.data.byStatus.Won).toBe(2);
  });

  it('should handle database errors', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = createAuthenticatedApp('get', '/dashboard/stats', leadStats);

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Lead API Authentication', () => {
  it('should require authentication for all lead endpoints', async () => {
    const app = express();
    app.use(express.json());
    app.get('/leads', authenticate, listLeads);
    app.get('/leads/:id', authenticate, getLead);
    app.post('/leads', authenticate, addLead);
    app.put('/leads/:id', authenticate, updateLeadHandler);
    app.delete('/leads/:id', authenticate, deleteLeadHandler);
    app.get('/dashboard/stats', authenticate, leadStats);

    const endpoints = [
      { method: 'get' as const, path: '/leads' },
      { method: 'get' as const, path: '/leads/lead-123' },
      { method: 'post' as const, path: '/leads' },
      { method: 'put' as const, path: '/leads/lead-123' },
      { method: 'delete' as const, path: '/leads/lead-123' },
      { method: 'get' as const, path: '/dashboard/stats' }
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)[endpoint.method](endpoint.path);
      expect(res.status).toBe(401);
    }
  });

  it('should reject expired token', async () => {
    const expiredToken = jwt.sign(
      { id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const app = express();
    app.use(express.json());
    app.get('/leads', authenticate, listLeads);

    const res = await request(app)
      .get('/leads')
      .set('Authorization', makeAuthHeader(expiredToken));

    expect(res.status).toBe(401);
  });

  it('should reject invalid token format', async () => {
    const app = express();
    app.use(express.json());
    app.get('/leads', authenticate, listLeads);

    const res = await request(app)
      .get('/leads')
      .set('Authorization', 'Bearer invalid-token-format');

    expect(res.status).toBe(401);
  });
});

describe('Lead Controller - Edge Cases', () => {
  it('should handle leads with null company data', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'lead-1',
          company_name: null,
          company_website: null,
          industry: null,
          city: null
        }]
      });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.data[0].company_name).toBeNull();
  });

  it('should sanitize sort parameters', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    await request(app)
      .get('/leads')
      .query({ sortBy: 'malicious_field; DROP TABLE leads;', sortOrder: 'ASC' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY l.created_at ASC'),
      expect.any(Array)
    );
  });

  it('should handle very large page numbers', async () => {
    const pool = getMockPool();
    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    const res = await request(app)
      .get('/leads')
      .query({ page: '999999', limit: '50' })
      .set('Authorization', makeAuthHeader(AUTH_TOKEN));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should handle leads with various status values', async () => {
    const pool = getMockPool();
    const statuses = ['New', 'Qualified', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost'];

    for (const status of statuses) {
      setupAuthMocks();
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1', status }] });
    }

    const app = createAuthenticatedApp('get', '/leads', listLeads);

    for (const status of statuses) {
      const res = await request(app)
        .get('/leads')
        .query({ status })
        .set('Authorization', makeAuthHeader(AUTH_TOKEN));

      expect(res.status).toBe(200);
    }
  });
});
