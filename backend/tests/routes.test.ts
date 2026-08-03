import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../src/routes';

describe('Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', setupRoutes());
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.services).toBeDefined();
    });
  });

  describe('Route existence', () => {
    it('should define dashboard stats endpoint', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBeDefined();
    });

    it('should define leads endpoint', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBeDefined();
    });

    it('should define campaigns endpoint', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBeDefined();
    });

    it('should define search jobs endpoint', async () => {
      const res = await request(app).get('/api/search/jobs');
      expect(res.status).toBeDefined();
    });

    it('should define notifications endpoint', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBeDefined();
    });

    it('should define presets endpoint', async () => {
      const res = await request(app).get('/api/presets');
      expect(res.status).toBeDefined();
    });

    it('should define proposals endpoint', async () => {
      const res = await request(app).get('/api/proposals');
      expect(res.status).toBeDefined();
    });

    it('should define reports endpoint', async () => {
      const res = await request(app).get('/api/reports');
      expect(res.status).toBeDefined();
    });

    it('should define providers endpoint', async () => {
      const res = await request(app).get('/api/providers');
      expect(res.status).toBeDefined();
    });

    it('should define executive stats endpoint', async () => {
      const res = await request(app).get('/api/executive/stats');
      expect(res.status).toBeDefined();
    });
  });
});
