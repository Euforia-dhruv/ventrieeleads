import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../database/connection';
import { redisClient } from '../database/redis';
import { logger } from '../core/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspace_id: string;
  email_verified: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  workspaceId?: string;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, workspace_id: user.workspace_id },
    JWT_SECRET,
    { expiresIn: 7 * 24 * 60 * 60 }
  );
}

export function generateRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: 30 * 24 * 60 * 60 }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const isRevoked = await redisClient.getClient().get(`revoked:${token}`);
    if (isRevoked) {
      res.status(401).json({ success: false, message: 'Token has been revoked' });
      return;
    }

    const decoded = verifyToken(token);
    if (decoded.type === 'refresh') {
      res.status(401).json({ success: false, message: 'Invalid token type' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, name, role, workspace_id, email_verified, is_active FROM users WHERE id = $1 AND is_deleted = false',
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      res.status(401).json({ success: false, message: 'User not found or inactive' });
      return;
    }

    const user = result.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspace_id: user.workspace_id,
      email_verified: user.email_verified
    };
    req.workspaceId = user.workspace_id;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    logger.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export async function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (req.user.role === 'super_admin' || req.user.role === 'owner') {
      next();
      return;
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 1 FROM user_workspace_roles uwr
      JOIN role_permissions rp ON rp.role_id = uwr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE uwr.user_id = $1 AND uwr.workspace_id = $2 AND p.name = $3
    `, [req.user.id, req.workspaceId, permission]);

    if (result.rows.length === 0) {
      res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
      return;
    }

    next();
  };
}

export async function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;
    if (!apiKeyHeader) {
      next();
      return;
    }

    const prefix = apiKeyHeader.substring(0, 8);
    const pool = getPool();
    const result = await pool.query(
      `SELECT ak.*, u.id as user_id, u.email, u.name, u.role
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_prefix = $1 AND ak.is_active = true AND ak.workspace_id IS NOT NULL
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [prefix]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid API key' });
      return;
    }

    const key = result.rows[0];

    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.default.compare(apiKeyHeader, key.key_hash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid API key' });
      return;
    }

    await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]);

    req.user = {
      id: key.user_id,
      email: key.email,
      name: key.name,
      role: key.role,
      workspace_id: key.workspace_id,
      email_verified: true
    };
    req.workspaceId = key.workspace_id;

    next();
  } catch (error) {
    logger.error('API key auth error:', error);
    next();
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    authenticateApiKey(req, res, next);
    return;
  }

  if (!authHeader && !cookieToken) {
    next();
    return;
  }

  authenticate(req, res, next);
}
