import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import { AuthRequest } from '../middleware/auth';

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `vl_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 8);
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

export async function listApiKeys(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, key_prefix, type, scopes, rate_limit, expires_at, last_used_at, is_active, created_at
       FROM api_keys WHERE workspace_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [req.workspaceId, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('List API keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to list API keys' });
  }
}

export async function createApiKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { name, type = 'personal', scopes = ['read'], rate_limit = 100, expires_at } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    const validTypes = ['personal', 'workspace', 'readonly', 'service_account'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ success: false, message: `Type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const pool = getPool();
    const { key, prefix, hash } = generateApiKey();

    const result = await pool.query(
      `INSERT INTO api_keys (workspace_id, user_id, name, key_prefix, key_hash, type, scopes, rate_limit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, key_prefix, type, scopes, rate_limit, expires_at, is_active, created_at`,
      [req.workspaceId, req.user.id, name, prefix, hash, type, JSON.stringify(scopes), rate_limit, expires_at || null]
    );

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        key
      },
      message: 'Save this API key - it will not be shown again'
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to create API key' });
  }
}

export async function revokeApiKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND workspace_id = $2 AND user_id = $3 RETURNING id`,
      [id, req.workspaceId, req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'API key not found' });
      return;
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    logger.error('Revoke API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke API key' });
  }
}

export async function deleteApiKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `DELETE FROM api_keys WHERE id = $1 AND workspace_id = $2 AND user_id = $3 RETURNING id`,
      [id, req.workspaceId, req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'API key not found' });
      return;
    }

    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete API key' });
  }
}

export async function getApiKeyUsage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, name, key_prefix, type, last_used_at, created_at FROM api_keys WHERE id = $1 AND workspace_id = $2`,
      [id, req.workspaceId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'API key not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Get API key usage error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch API key usage' });
  }
}
