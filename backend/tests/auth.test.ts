import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.BCRYPT_ROUNDS = '4';
process.env.NODE_ENV = 'test';

const JWT_SECRET = 'test-secret-for-ci';
const BCRYPT_ROUNDS = 4;

const mockQuery = jest.fn();
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSetEx = jest.fn().mockResolvedValue('OK');
const mockRedisDel = jest.fn().mockResolvedValue(1);
const mockRedisKeys = jest.fn().mockResolvedValue([]);
const mockRedisQuit = jest.fn().mockResolvedValue('OK');

jest.mock('../src/database/connection', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery
  }))
}));

jest.mock('../src/database/redis', () => ({
  redisClient: {
    getClient: jest.fn(() => ({
      get: mockRedisGet,
      setEx: mockRedisSetEx,
      del: mockRedisDel,
      keys: mockRedisKeys,
      quit: mockRedisQuit
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
  register, login, logout, logoutAll, me, refreshToken,
  forgotPassword, resetPassword, changePassword,
  verifyEmail, sendVerificationEmail,
  requestMagicLink, verifyMagicLink,
  getSessions, revokeSession, updateProfile, oauthCallback
} from '../src/controllers/authController';
import { authenticate, generateToken, generateRefreshToken, verifyToken } from '../src/middleware/auth';

function getMockPool() {
  return (getPool as jest.Mock)();
}

function makeAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

function createTestToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function createRefreshToken(userId: string): string {
  return jwt.sign({ id: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSetEx.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
});

// Helper to setup auth middleware mocks for authenticated routes
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

describe('Auth Controller - Registration', () => {
  it('should register a new user with valid data', async () => {
    const pool = getMockPool();
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      workspace_id: 'ws-123',
      email_verified: false
    };

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'ws-123' }] })
      .mockResolvedValueOnce({ rows: [mockUser] })
      .mockResolvedValueOnce({ rows: [{ id: 'role-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.workspace).toBeDefined();
  });

  it('should reject registration with missing fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('required');
  });

  it('should reject registration with weak password', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        name: 'Test User',
        password: '1234567'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('8 characters');
  });

  it('should reject registration with invalid email', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'invalid-email',
        name: 'Test User',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid email');
  });

  it('should reject duplicate email', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'existing@example.com',
        name: 'Test User',
        password: 'password123'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already registered');
  });

  it('should lowercase email during registration', async () => {
    const pool = getMockPool();
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      workspace_id: 'ws-123',
      email_verified: false
    };

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'ws-123' }] })
      .mockResolvedValueOnce({ rows: [mockUser] })
      .mockResolvedValueOnce({ rows: [{ id: 'role-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', register);

    await request(app)
      .post('/test')
      .send({
        email: 'TEST@EXAMPLE.COM',
        name: 'Test User',
        password: 'password123'
      });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM users WHERE email'),
      ['test@example.com']
    );
  });

  it('should handle database errors during registration', async () => {
    const pool = getMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB connection failed'));

    const app = express();
    app.use(express.json());
    app.post('/test', register);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Registration failed');
  });
});

describe('Auth Controller - Login', () => {
  it('should login with valid credentials', async () => {
    const pool = getMockPool();
    const hashedPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);

    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
          workspace_id: 'ws-123',
          hashed_password: hashedPassword,
          is_active: true,
          email_verified: true
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', login);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('should reject login with invalid email', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', login);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid email or password');
  });

  it('should reject login with wrong password', async () => {
    const pool = getMockPool();
    const hashedPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123',
        email: 'test@example.com',
        hashed_password: hashedPassword,
        is_active: true
      }]
    });

    const app = express();
    app.use(express.json());
    app.post('/test', login);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject login for inactive account', async () => {
    const pool = getMockPool();
    const hashedPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123',
        email: 'test@example.com',
        hashed_password: hashedPassword,
        is_active: false
      }]
    });

    const app = express();
    app.use(express.json());
    app.post('/test', login);

    const res = await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('disabled');
  });

  it('should reject login with missing fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', login);

    const res = await request(app)
      .post('/test')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should handle remember_me flag for extended session', async () => {
    const pool = getMockPool();
    const hashedPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
          workspace_id: 'ws-123',
          hashed_password: hashedPassword,
          is_active: true,
          email_verified: true
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', login);

    await request(app)
      .post('/test')
      .send({
        email: 'test@example.com',
        password: 'password123',
        remember_me: true
      });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('90 days'),
      expect.any(Array)
    );
  });
});

describe('Auth Controller - Token Refresh', () => {
  it('should refresh token with valid refresh token', async () => {
    const pool = getMockPool();
    const userId = 'user-123';
    const refreshTokenValue = createRefreshToken(userId);

    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'session-1',
          user_id: userId,
          uid: userId,
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
          workspace_id: 'ws-123',
          email_verified: true,
          is_active: true,
          user_agent: 'test-agent',
          ip_address: '127.0.0.1',
          device_name: 'Chrome',
          device_type: 'desktop'
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    const res = await request(app)
      .post('/test')
      .send({ refreshToken: refreshTokenValue });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('should reject refresh without token', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('required');
  });

  it('should reject invalid refresh token', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    const res = await request(app)
      .post('/test')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject expired refresh token', async () => {
    const expiredToken = jwt.sign(
      { id: 'user-123', type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    const res = await request(app)
      .post('/test')
      .send({ refreshToken: expiredToken });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-refresh token type', async () => {
    const accessToken = jwt.sign(
      { id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    const res = await request(app)
      .post('/test')
      .send({ refreshToken: accessToken });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid token type');
  });

  it('should revoke old session on refresh', async () => {
    const pool = getMockPool();
    const refreshTokenValue = createRefreshToken('user-123');

    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'session-1',
          user_id: 'user-123',
          uid: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
          workspace_id: 'ws-123',
          email_verified: true,
          is_active: true,
          user_agent: 'test-agent',
          ip_address: '127.0.0.1',
          device_name: 'Chrome',
          device_type: 'desktop'
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', refreshToken);

    await request(app)
      .post('/test')
      .send({ refreshToken: refreshTokenValue });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE sessions SET is_revoked = true WHERE id = $1',
      ['session-1']
    );
  });
});

describe('Auth Controller - Logout', () => {
  it('should logout successfully', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', logout);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Logged out');
  });

  it('should revoke session token on logout', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', logout);

    await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE sessions SET is_revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
  });
});

describe('Auth Controller - Logout All', () => {
  it('should logout from all devices', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, logoutAll);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth Controller - Get Current User', () => {
  it('should return current user data', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
          workspace_id: 'ws-123',
          is_active: true,
          email_verified: true,
          avatar_url: null,
          created_at: new Date(),
          last_login_at: new Date()
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'ws-123', name: 'Test Workspace', slug: 'test', plan: 'free' }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, me);

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@example.com');
    expect(res.body.data.workspace).toBeDefined();
    expect(res.body.data.sessions).toBeDefined();
  });

  it('should return 401 without auth token', async () => {
    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, me);

    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
  });
});

describe('Auth Controller - Forgot Password', () => {
  it('should process forgot password request', async () => {
    const pool = getMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', forgotPassword);

    const res = await request(app)
      .post('/test')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return same message for non-existent email', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', forgotPassword);

    const res = await request(app)
      .post('/test')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should require email field', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', forgotPassword);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Controller - Reset Password', () => {
  it('should reset password with valid token', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'reset-1', user_id: 'user-123', used_at: null }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    const res = await request(app)
      .post('/test')
      .send({ token: 'valid-reset-token', password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Password reset successful');
  });

  it('should reject reset with expired token', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    const res = await request(app)
      .post('/test')
      .send({ token: 'expired-token', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid or expired');
  });

  it('should reject reset with already used token', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'reset-1', user_id: 'user-123', used_at: new Date() }]
    });

    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    const res = await request(app)
      .post('/test')
      .send({ token: 'used-token', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already used');
  });

  it('should reject reset with weak password', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    const res = await request(app)
      .post('/test')
      .send({ token: 'some-token', password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('8 characters');
  });

  it('should require both token and password', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    const res = await request(app)
      .post('/test')
      .send({ token: 'some-token' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should revoke all sessions on password reset', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'reset-1', user_id: 'user-123', used_at: null }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', resetPassword);

    await request(app)
      .post('/test')
      .send({ token: 'valid-reset-token', password: 'newpassword123' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE sessions SET is_revoked = true WHERE user_id = $1',
      ['user-123']
    );
  });
});

describe('Auth Controller - Change Password', () => {
  it('should change password with valid current password', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });
    const hashedPassword = await bcrypt.hash('oldpassword', BCRYPT_ROUNDS);

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ hashed_password: hashedPassword }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, changePassword);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ current_password: 'oldpassword', new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Password changed');
  });

  it('should reject with incorrect current password', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });
    const hashedPassword = await bcrypt.hash('oldpassword', BCRYPT_ROUNDS);

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [{ hashed_password: hashedPassword }] });

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, changePassword);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ current_password: 'wrongpassword', new_password: 'newpassword123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('incorrect');
  });

  it('should reject weak new password', async () => {
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, changePassword);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ current_password: 'oldpassword', new_password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('8 characters');
  });

  it('should revoke all sessions after password change', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });
    const hashedPassword = await bcrypt.hash('oldpassword', BCRYPT_ROUNDS);

    setupAuthMocks();
    pool.query
      .mockResolvedValueOnce({ rows: [{ hashed_password: hashedPassword }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, changePassword);

    await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ current_password: 'oldpassword', new_password: 'newpassword123' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      ['user-123']
    );
  });
});

describe('Auth Controller - Verify Email', () => {
  it('should verify email with valid token', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'vt-1', user_id: 'user-123', verified_at: null }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyEmail);

    const res = await request(app)
      .post('/test')
      .send({ token: 'valid-verify-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('verified');
  });

  it('should handle already verified email', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'vt-1', user_id: 'user-123', verified_at: new Date() }]
    });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyEmail);

    const res = await request(app)
      .post('/test')
      .send({ token: 'already-verified-token' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('verified');
  });

  it('should reject invalid verification token', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyEmail);

    const res = await request(app)
      .post('/test')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should require token field', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', verifyEmail);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Controller - Send Verification Email', () => {
  it('should send verification email', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, sendVerificationEmail);

    const res = await request(app)
      .post('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Verification email sent');
  });

  it('should require authentication', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', authenticate, sendVerificationEmail);

    const res = await request(app).post('/test');

    expect(res.status).toBe(401);
  });
});

describe('Auth Controller - Sessions', () => {
  it('should list active sessions', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 's1', device_name: 'Chrome', device_type: 'desktop', ip_address: '127.0.0.1' },
        { id: 's2', device_name: 'Safari Mobile', device_type: 'mobile', ip_address: '192.168.1.1' }
      ]
    });

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, getSessions);

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('should revoke a session', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'session-1' }] });

    const app = express();
    app.use(express.json());
    app.delete('/test/:id', authenticate, revokeSession);

    const res = await request(app)
      .delete('/test/session-1')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('revoked');
  });

  it('should return 404 for non-existent session', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.delete('/test/:id', authenticate, revokeSession);

    const res = await request(app)
      .delete('/test/non-existent')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Controller - Update Profile', () => {
  it('should update profile name', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123', email: 'test@example.com', name: 'Updated Name',
        role: 'owner', workspace_id: 'ws-123', avatar_url: null
      }]
    });

    const app = express();
    app.use(express.json());
    app.put('/test', authenticate, updateProfile);

    const res = await request(app)
      .put('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('should return 400 when no fields to update', async () => {
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();

    const app = express();
    app.use(express.json());
    app.put('/test', authenticate, updateProfile);

    const res = await request(app)
      .put('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No fields');
  });

  it('should update avatar_url', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    setupAuthMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123', email: 'test@example.com', name: 'Test User',
        role: 'owner', workspace_id: 'ws-123', avatar_url: 'https://example.com/avatar.png'
      }]
    });

    const app = express();
    app.use(express.json());
    app.put('/test', authenticate, updateProfile);

    const res = await request(app)
      .put('/test')
      .set('Authorization', makeAuthHeader(token))
      .send({ avatar_url: 'https://example.com/avatar.png' });

    expect(res.status).toBe(200);
    expect(res.body.data.avatar_url).toBe('https://example.com/avatar.png');
  });
});

describe('Auth Controller - OAuth Callback', () => {
  it('should handle OAuth callback for new user', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({ rows: [] })                                  // 1. SELECT oauth_connections
      .mockResolvedValueOnce({ rows: [] })                                  // 2. SELECT users by email
      .mockResolvedValueOnce({ rows: [{ id: 'ws-new' }] })                 // 3. INSERT workspace
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-new', email: 'oauth@example.com', name: 'OAuth User',
          role: 'owner', workspace_id: 'ws-new', email_verified: true
        }]
      })                                                                    // 4. INSERT user
      .mockResolvedValueOnce({ rows: [{ id: 'role-1' }] })                 // 5. SELECT roles
      .mockResolvedValueOnce({ rows: [] })                                  // 6. INSERT user_workspace_roles
      .mockResolvedValueOnce({ rows: [] })                                  // 7. INSERT oauth_connections
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-new', email: 'oauth@example.com', name: 'OAuth User',
          role: 'owner', workspace_id: 'ws-new', email_verified: true
        }]
      })                                                                    // 8. SELECT user final
      .mockResolvedValueOnce({ rows: [] });                                 // 9. INSERT sessions

    const app = express();
    app.use(express.json());
    app.post('/test', oauthCallback);

    const res = await request(app)
      .post('/test')
      .send({
        provider: 'google',
        provider_user_id: 'google-123',
        email: 'oauth@example.com',
        name: 'OAuth User',
        avatar_url: 'https://example.com/avatar.jpg',
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should handle OAuth callback for existing user', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'existing-user', email: 'existing@example.com', name: 'Existing',
          role: 'owner', workspace_id: 'ws-1', email_verified: true
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', oauthCallback);

    const res = await request(app)
      .post('/test')
      .send({
        provider: 'google',
        provider_user_id: 'google-456',
        email: 'existing@example.com',
        name: 'Existing User',
        access_token: 'token'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should update existing OAuth connection', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-123' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-123', email: 'test@example.com', name: 'Test',
          role: 'owner', workspace_id: 'ws-1', email_verified: true
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', oauthCallback);

    await request(app)
      .post('/test')
      .send({
        provider: 'google',
        provider_user_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        access_token: 'new-token',
        refresh_token: 'new-refresh'
      });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE oauth_connections'),
      expect.any(Array)
    );
  });

  it('should reject OAuth callback with missing data', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', oauthCallback);

    const res = await request(app)
      .post('/test')
      .send({ provider: 'google' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should handle OAuth callback database errors', async () => {
    const pool = getMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const app = express();
    app.use(express.json());
    app.post('/test', oauthCallback);

    const res = await request(app)
      .post('/test')
      .send({
        provider: 'google',
        provider_user_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User'
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Controller - Magic Link', () => {
  it('should request magic link', async () => {
    const pool = getMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', requestMagicLink);

    const res = await request(app)
      .post('/test')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return same message for non-existent email', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', requestMagicLink);

    const res = await request(app)
      .post('/test')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should require email', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', requestMagicLink);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should verify magic link and login', async () => {
    const pool = getMockPool();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'ml-1', email: 'test@example.com', used_at: null }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-123', email: 'test@example.com', name: 'Test User',
          role: 'owner', workspace_id: 'ws-123', email_verified: false, is_active: true
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyMagicLink);

    const res = await request(app)
      .post('/test')
      .send({ token: 'valid-magic-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject used magic link', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'ml-1', email: 'test@example.com', used_at: new Date() }]
    });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyMagicLink);

    const res = await request(app)
      .post('/test')
      .send({ token: 'used-magic-token' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already used');
  });

  it('should reject expired magic link', async () => {
    const pool = getMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.post('/test', verifyMagicLink);

    const res = await request(app)
      .post('/test')
      .send({ token: 'expired-token' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid or expired');
  });

  it('should require token for magic link verification', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', verifyMagicLink);

    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Middleware', () => {
  it('should authenticate valid token', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123', email: 'test@example.com', name: 'Test User',
        role: 'owner', workspace_id: 'ws-123', email_verified: true, is_active: true
      }]
    });

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe('user-123');
  });

  it('should reject request without token', async () => {
    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
  });

  it('should reject expired token', async () => {
    const expiredToken = jwt.sign(
      { id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(expiredToken));

    expect(res.status).toBe(401);
  });

  it('should reject revoked token', async () => {
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    mockRedisGet.mockResolvedValueOnce('1');

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('revoked');
  });

  it('should reject refresh token used as access token', async () => {
    const refreshTokenValue = createRefreshToken('user-123');

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(refreshTokenValue));

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid token type');
  });

  it('should reject inactive user', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'user-123', email: 'test@example.com', is_active: false }]
    });

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(401);
  });

  it('should reject non-existent user', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'nonexistent', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    pool.query.mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use(express.json());
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Authorization', makeAuthHeader(token));

    expect(res.status).toBe(401);
  });

  it('should handle cookie-based token', async () => {
    const pool = getMockPool();
    const token = createTestToken({ id: 'user-123', email: 'test@example.com', role: 'owner', workspace_id: 'ws-123' });

    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-123', email: 'test@example.com', name: 'Test User',
        role: 'owner', workspace_id: 'ws-123', email_verified: true, is_active: true
      }]
    });

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use((req: any, _res: any, next: any) => {
      req.cookies = {};
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        cookieHeader.split(';').forEach((c: string) => {
          const [key, val] = c.trim().split('=');
          req.cookies[key] = val;
        });
      }
      next();
    });
    app.get('/test', authenticate, (req: any, res: any) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get('/test')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });
});

describe('Token Generation', () => {
  it('should generate valid access token', () => {
    const user = {
      id: 'user-123', email: 'test@example.com', name: 'Test User',
      role: 'owner', workspace_id: 'ws-123', email_verified: true
    };

    const token = generateToken(user);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.id).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);
    expect(decoded.workspace_id).toBe(user.workspace_id);
    expect(decoded.exp).toBeDefined();
  });

  it('should generate valid refresh token', () => {
    const user = {
      id: 'user-123', email: 'test@example.com', name: 'Test User',
      role: 'owner', workspace_id: 'ws-123', email_verified: true
    };

    const token = generateRefreshToken(user);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.id).toBe(user.id);
    expect(decoded.type).toBe('refresh');
    expect(decoded.exp).toBeDefined();
  });

  it('should generate different tokens for different users', () => {
    const user1 = { id: 'user-1', email: 'a@test.com', name: 'A', role: 'owner', workspace_id: 'ws-1', email_verified: true };
    const user2 = { id: 'user-2', email: 'b@test.com', name: 'B', role: 'owner', workspace_id: 'ws-2', email_verified: true };

    const token1 = generateToken(user1);
    const token2 = generateToken(user2);

    expect(token1).not.toBe(token2);
  });

  it('should verify valid token', () => {
    const user = {
      id: 'user-123', email: 'test@example.com', name: 'Test User',
      role: 'owner', workspace_id: 'ws-123', email_verified: true
    };

    const token = generateToken(user);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(user.id);
  });

  it('should throw on invalid token verification', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  it('should throw on tampered token', () => {
    const user = {
      id: 'user-123', email: 'test@example.com', name: 'Test User',
      role: 'owner', workspace_id: 'ws-123', email_verified: true
    };

    const token = generateToken(user);
    const tampered = token.slice(0, -5) + 'XXXXX';

    expect(() => verifyToken(tampered)).toThrow();
  });
});
