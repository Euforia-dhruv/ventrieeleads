import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { URL } from 'url';
import { getPool } from '../database/connection';
import { redisClient } from '../database/redis';
import { logger } from '../core/logger';
import {
  generateToken, generateRefreshToken, verifyToken, AuthRequest
} from '../middleware/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseUserAgent(ua: string | undefined): { device_type: string; device_name: string } {
  if (!ua) return { device_type: 'unknown', device_name: 'Unknown Device' };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const isBot = /Bot|Spider|Crawler/i.test(ua);
  let device_type = 'desktop';
  if (isBot) device_type = 'bot';
  else if (isTablet) device_type = 'tablet';
  else if (isMobile) device_type = 'mobile';

  let device_name = 'Unknown Device';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) device_name = 'Chrome';
  else if (/Firefox/i.test(ua)) device_name = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) device_name = 'Safari';
  else if (/Edg/i.test(ua)) device_name = 'Edge';
  else if (/iPhone|iPad/i.test(ua)) device_name = 'Safari Mobile';

  return { device_type, device_name };
}

// ── Register ────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, name, password, workspace_name } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ success: false, message: 'Email, name, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email format' });
      return;
    }

    const pool = getPool();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let slug = (workspace_name || name.toLowerCase().replace(/\s+/g, '-'))
      .replace(/[^a-z0-9-]/g, '').substring(0, 50) || `ws-${Date.now()}`;

    // Ensure unique workspace slug
    let finalSlug = slug;
    let suffix = 1;
    while (true) {
      const existingSlug = await pool.query('SELECT id FROM workspaces WHERE slug = $1', [finalSlug]);
      if (existingSlug.rows.length === 0) break;
      finalSlug = `${slug}-${suffix++}`;
    }

    const workspaceResult = await pool.query(
      `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
      [workspace_name || `${name}'s Workspace`, finalSlug]
    );
    const workspaceId = workspaceResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (email, name, hashed_password, role, workspace_id, is_active, email_verified)
       VALUES ($1, $2, $3, 'owner', $4, true, false) RETURNING id, email, name, role, workspace_id, email_verified`,
      [email.toLowerCase(), name, hashedPassword, workspaceId]
    );

    const user = userResult.rows[0];

    const ownerRole = await pool.query(`SELECT id FROM roles WHERE name = 'owner'`);
    if (ownerRole.rows.length > 0) {
      await pool.query(
        `INSERT INTO user_workspace_roles (user_id, workspace_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [user.id, workspaceId, ownerRole.rows[0].id]
      );
    }

    const tokenUser = { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, email_verified: user.email_verified };
    const token = generateToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    const tokenHash = hashToken(token);
    const refreshHash = hashToken(refreshToken);
    const { device_type, device_name } = parseUserAgent(req.headers['user-agent']);

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW() + INTERVAL '30 days')`,
      [user.id, tokenHash, refreshHash, req.headers['user-agent'], req.ip, device_name, device_type]
    );

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id },
        token,
        refreshToken,
        workspace: { id: workspaceId, name: workspace_name || `${name}'s Workspace`, slug }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

// ── Login ───────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, remember_me } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, role, workspace_id, hashed_password, is_active, email_verified
       FROM users WHERE email = $1 AND is_deleted = false`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(403).json({ success: false, message: 'Account is disabled' });
      return;
    }

    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const tokenUser = { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, email_verified: user.email_verified };
    const token = generateToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    const tokenHash = hashToken(token);
    const refreshHash = hashToken(refreshToken);
    const { device_type, device_name } = parseUserAgent(req.headers['user-agent']);

    const expiresIn = remember_me ? "90 days" : "7 days";
    const refreshExpiresIn = remember_me ? "180 days" : "30 days";

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${expiresIn}', NOW() + INTERVAL '${refreshExpiresIn}')`,
      [user.id, tokenHash, refreshHash, req.headers['user-agent'], req.ip, device_name, device_type]
    );

    await pool.query(
      'UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id },
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
}

// ── Refresh Token ───────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: refreshTokenValue } = req.body;
    if (!refreshTokenValue) {
      res.status(400).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const decoded = verifyToken(refreshTokenValue);
    if (decoded.type !== 'refresh') {
      res.status(401).json({ success: false, message: 'Invalid token type' });
      return;
    }

    const pool = getPool();
    const refreshHash = hashToken(refreshTokenValue);

    const session = await pool.query(
      `SELECT s.*, u.id as uid, u.email, u.name, u.role, u.workspace_id, u.email_verified, u.is_active
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token_hash = $1 AND s.is_revoked = false AND s.refresh_expires_at > NOW()`,
      [refreshHash]
    );

    if (session.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }

    const s = session.rows[0];
    if (!s.is_active) {
      res.status(403).json({ success: false, message: 'Account is disabled' });
      return;
    }

    await pool.query('UPDATE sessions SET is_revoked = true WHERE id = $1', [s.id]);

    const tokenUser = { id: s.uid, email: s.email, name: s.name, role: s.role, workspace_id: s.workspace_id, email_verified: s.email_verified };
    const newToken = generateToken(tokenUser);
    const newRefresh = generateRefreshToken(tokenUser);

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW() + INTERVAL '30 days')`,
      [s.user_id, hashToken(newToken), hashToken(newRefresh), s.user_agent, s.ip_address, s.device_name, s.device_type]
    );

    res.json({
      success: true,
      data: { token: newToken, refreshToken: newRefresh }
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    logger.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
}

// ── Logout ──────────────────────────────────────────────────
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

    if (token) {
      const pool = getPool();
      const tokenHash = hashToken(token);
      await pool.query('UPDATE sessions SET is_revoked = true WHERE token_hash = $1', [tokenHash]);

      try {
        await redisClient.getClient().setEx(`revoked:${token}`, 7 * 24 * 60 * 60, '1');
      } catch (e) { /* Redis optional */ }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
}

// ── Logout All Devices ──────────────────────────────────────
export async function logoutAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const pool = getPool();
    await pool.query('UPDATE sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false', [req.user.id]);

    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (error) {
    logger.error('Logout all error:', error);
    res.status(500).json({ success: false, message: 'Failed to logout from all devices' });
  }
}

// ── Get Current User ────────────────────────────────────────
export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, role, workspace_id, is_active, email_verified, avatar_url, created_at, last_login_at
       FROM users WHERE id = $1 AND is_deleted = false`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const workspace = await pool.query(
      'SELECT id, name, slug, plan FROM workspaces WHERE id = $1',
      [result.rows[0].workspace_id]
    );

    const sessions = await pool.query(
      `SELECT id, device_name, device_type, ip_address, created_at, last_accessed_at
       FROM sessions WHERE user_id = $1 AND is_revoked = false ORDER BY created_at DESC LIMIT 10`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        workspace: workspace.rows[0] || null,
        sessions: sessions.rows
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
}

// ── Forgot Password ─────────────────────────────────────────
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query('SELECT id FROM users WHERE email = $1 AND is_deleted = false', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      return;
    }

    const userId = result.rows[0].id;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, tokenHash]
    );

    logger.info(`Password reset token for ${email}: ${resetToken}`);

    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
}

// ── Reset Password ──────────────────────────────────────────
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const pool = getPool();
    const tokenHash = hashToken(token);

    const result = await pool.query(
      `SELECT id, user_id, used_at FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    const resetToken = result.rows[0];
    if (resetToken.used_at) {
      res.status(400).json({ success: false, message: 'Reset token already used' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET hashed_password = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);
    await pool.query('UPDATE sessions SET is_revoked = true WHERE user_id = $1', [resetToken.user_id]);

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
}

// ── Change Password ─────────────────────────────────────────
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      res.status(400).json({ success: false, message: 'Current and new password are required' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }

    const pool = getPool();
    const result = await pool.query('SELECT hashed_password FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(current_password, result.rows[0].hashed_password);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET hashed_password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    await pool.query(
      'UPDATE sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      [req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
}

// ── Verify Email ────────────────────────────────────────────
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    const pool = getPool();
    const tokenHash = hashToken(token);

    const result = await pool.query(
      `SELECT id, user_id, verified_at FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
      return;
    }

    const vt = result.rows[0];
    if (vt.verified_at) {
      res.json({ success: true, message: 'Email already verified' });
      return;
    }

    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [vt.user_id]);
    await pool.query('UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1', [vt.id]);

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Verify email error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify email' });
  }
}

// ── Send Verification Email ─────────────────────────────────
export async function sendVerificationEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const pool = getPool();
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(verifyToken);

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [req.user.id, tokenHash]
    );

    logger.info(`Email verification token for ${req.user.email}: ${verifyToken}`);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    logger.error('Send verification email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send verification email' });
  }
}

// ── Magic Link Request ──────────────────────────────────────
export async function requestMagicLink(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query('SELECT id FROM users WHERE email = $1 AND is_deleted = false', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      res.json({ success: true, message: 'If the email exists, a magic link has been sent' });
      return;
    }

    const magicToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(magicToken);

    await pool.query(
      `INSERT INTO magic_link_tokens (email, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [email.toLowerCase(), tokenHash]
    );

    logger.info(`Magic link for ${email}: ${magicToken}`);

    res.json({ success: true, message: 'If the email exists, a magic link has been sent' });
  } catch (error) {
    logger.error('Magic link error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
}

// ── Verify Magic Link ──────────────────────────────────────
export async function verifyMagicLink(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    const pool = getPool();
    const tokenHash = hashToken(token);

    const result = await pool.query(
      `SELECT id, email, used_at FROM magic_link_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired magic link' });
      return;
    }

    const ml = result.rows[0];
    if (ml.used_at) {
      res.status(400).json({ success: false, message: 'Magic link already used' });
      return;
    }

    await pool.query('UPDATE magic_link_tokens SET used_at = NOW() WHERE id = $1', [ml.id]);

    const userResult = await pool.query(
      `SELECT id, email, name, role, workspace_id, email_verified, is_active FROM users WHERE email = $1 AND is_deleted = false`,
      [ml.email]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, message: 'Account is disabled' });
      return;
    }

    if (!user.email_verified) {
      await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
    }

    const tokenUser = { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, email_verified: true };
    const accessToken = generateToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    const { device_type, device_name } = parseUserAgent(req.headers['user-agent']);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW() + INTERVAL '30 days')`,
      [user.id, hashToken(accessToken), hashToken(refreshToken), req.headers['user-agent'], req.ip, device_name, device_type]
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id },
        token: accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Verify magic link error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify magic link' });
  }
}

// ── Get Sessions ────────────────────────────────────────────
export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, device_name, device_type, ip_address, user_agent, created_at, expires_at
       FROM sessions WHERE user_id = $1 AND is_revoked = false ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
}

// ── Revoke Session ──────────────────────────────────────────
export async function revokeSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      'UPDATE sessions SET is_revoked = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    logger.error('Revoke session error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
}

// ── Update Profile ──────────────────────────────────────────
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { name, avatar_url } = req.body;
    const pool = getPool();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) { updates.push(`name = $${idx++}`); values.push(name); }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${idx++}`); values.push(avatar_url); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }

    updates.push('updated_at = NOW()');
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, workspace_id, avatar_url`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

// ── OAuth Callback (Google/GitHub) ──────────────────────────
export async function oauthCallback(req: Request, res: Response): Promise<void> {
  try {
    const { provider, provider_user_id, email, name, avatar_url, access_token, refresh_token } = req.body;

    if (!provider || !provider_user_id || !email) {
      res.status(400).json({ success: false, message: 'Missing required OAuth data' });
      return;
    }

    const pool = getPool();

    const oauthResult = await pool.query(
      `SELECT user_id FROM oauth_connections WHERE provider = $1 AND provider_user_id = $2`,
      [provider, provider_user_id]
    );

    let userId: string;

    if (oauthResult.rows.length > 0) {
      userId = oauthResult.rows[0].user_id;
      await pool.query(
        `UPDATE oauth_connections SET access_token = $1, refresh_token = $2, provider_name = $3, provider_avatar = $4, updated_at = NOW()
         WHERE provider = $5 AND provider_user_id = $6`,
        [access_token, refresh_token, name, avatar_url, provider, provider_user_id]
      );
    } else {
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        const workspaceResult = await pool.query(
          `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
          [`${name}'s Workspace`, `${provider}-${provider_user_id.substring(0, 8)}`]
        );

        const userResult = await pool.query(
          `INSERT INTO users (email, name, hashed_password, role, workspace_id, is_active, email_verified, avatar_url)
           VALUES ($1, $2, $3, 'owner', $4, true, true, $5) RETURNING id`,
          [email.toLowerCase(), name, await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS), workspaceResult.rows[0].id, avatar_url]
        );
        userId = userResult.rows[0].id;

        const ownerRole = await pool.query(`SELECT id FROM roles WHERE name = 'owner'`);
        if (ownerRole.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_workspace_roles (user_id, workspace_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [userId, workspaceResult.rows[0].id, ownerRole.rows[0].id]
          );
        }
      }

      await pool.query(
        `INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar, access_token, refresh_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, provider, provider_user_id, email, name, avatar_url, access_token, refresh_token]
      );
    }

    const userResult = await pool.query(
      'SELECT id, email, name, role, workspace_id, email_verified FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    const tokenUser = { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, email_verified: user.email_verified };
    const token = generateToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    const { device_type, device_name } = parseUserAgent(req.headers['user-agent']);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW() + INTERVAL '30 days')`,
      [userId, hashToken(token), hashToken(refreshToken), req.headers['user-agent'], req.ip, device_name, device_type]
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id },
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).json({ success: false, message: 'OAuth authentication failed' });
  }
}

// ── Google OAuth: Redirect to Google ────────────────────────
export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(503).json({ success: false, message: 'Google OAuth not configured' });
      return;
    }

    const state = crypto.randomBytes(32).toString('hex');
    const frontendUrl = req.query.returnTo as string || FRONTEND_URL;

    try {
      await redisClient.getClient().setEx(`oauth_state:${state}`, 600, frontendUrl);
    } catch (e) {
      logger.warn('Redis unavailable for OAuth state, using state param only');
    }

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    logger.error('Google auth redirect error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate Google OAuth' });
  }
}

// ── Google OAuth: Handle Callback ───────────────────────────
export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error: googleError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (googleError) {
      logger.warn(`Google OAuth error: ${googleError}`);
      res.redirect(`${FRONTEND_URL}/login?error=google_denied`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
      return;
    }

    let redirectBase = FRONTEND_URL;
    try {
      const stored = await redisClient.getClient().get(`oauth_state:${state}`);
      if (stored) redirectBase = stored;
      await redisClient.getClient().del(`oauth_state:${state}`);
    } catch (e) {
      logger.warn('Redis unavailable for state verification');
    }

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }, { timeout: 10000 });

    const { access_token, refresh_token, id_token } = tokenRes.data;

    let googleUserId = '';
    let googleEmail = '';
    let googleName = '';
    let googleAvatar = '';

    try {
      const payload = JSON.parse(
        Buffer.from(id_token.split('.')[1], 'base64url').toString()
      );
      googleUserId = payload.sub;
      googleEmail = payload.email || '';
      googleName = payload.name || '';
      googleAvatar = payload.picture || '';
    } catch {
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });
      googleUserId = userInfoRes.data.id;
      googleEmail = userInfoRes.data.email || '';
      googleName = userInfoRes.data.name || '';
      googleAvatar = userInfoRes.data.picture || '';
    }

    if (!googleUserId || !googleEmail) {
      res.redirect(`${FRONTEND_URL}/login?error=google_no_email`);
      return;
    }

    const pool = getPool();

    const oauthResult = await pool.query(
      `SELECT user_id FROM oauth_connections WHERE provider = $1 AND provider_user_id = $2`,
      ['google', googleUserId]
    );

    let userId: string;

    if (oauthResult.rows.length > 0) {
      userId = oauthResult.rows[0].user_id;
      await pool.query(
        `UPDATE oauth_connections SET access_token = $1, refresh_token = $2, provider_name = $3, provider_avatar = $4, updated_at = NOW()
         WHERE provider = $5 AND provider_user_id = $6`,
        [access_token, refresh_token || null, googleName, googleAvatar, 'google', googleUserId]
      );

      if (googleAvatar) {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2 AND avatar_url IS NULL', [googleAvatar, userId]);
      }
    } else {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND is_deleted = false',
        [googleEmail.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        let slug = `google-${googleUserId.substring(0, 8)}`;
        let finalSlug = slug;
        let suffix = 1;
        while (true) {
          const existingSlug = await pool.query('SELECT id FROM workspaces WHERE slug = $1', [finalSlug]);
          if (existingSlug.rows.length === 0) break;
          finalSlug = `${slug}-${suffix++}`;
        }

        const workspaceResult = await pool.query(
          `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
          [`${googleName || googleEmail.split('@')[0]}'s Workspace`, finalSlug]
        );

        const userResult = await pool.query(
          `INSERT INTO users (email, name, hashed_password, role, workspace_id, is_active, email_verified, avatar_url)
           VALUES ($1, $2, $3, 'owner', $4, true, true, $5) RETURNING id`,
          [googleEmail.toLowerCase(), googleName, await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS), workspaceResult.rows[0].id, googleAvatar || null]
        );
        userId = userResult.rows[0].id;

        const ownerRole = await pool.query(`SELECT id FROM roles WHERE name = 'owner'`);
        if (ownerRole.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_workspace_roles (user_id, workspace_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [userId, workspaceResult.rows[0].id, ownerRole.rows[0].id]
          );
        }
      }

      await pool.query(
        `INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_email, provider_name, provider_avatar, access_token, refresh_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, 'google', googleUserId, googleEmail, googleName, googleAvatar, access_token, refresh_token || null]
      );
    }

    const userResult = await pool.query(
      `SELECT id, email, name, role, workspace_id, email_verified FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];

    const tokenUser = { id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, email_verified: user.email_verified };
    const token = generateToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    const { device_type, device_name } = parseUserAgent(req.headers['user-agent']);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, user_agent, ip_address, device_name, device_type, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW() + INTERVAL '30 days')`,
      [userId, hashToken(token), hashToken(refreshToken), req.headers['user-agent'], req.ip, device_name, device_type]
    );

    await pool.query(
      'UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
      [userId]
    );

    const separator = redirectBase.includes('?') ? '&' : '?';
    res.redirect(`${redirectBase}/auth/callback${separator}token=${token}&refreshToken=${refreshToken}`);
  } catch (error: any) {
    logger.error('Google OAuth callback error:', error?.response?.data || error.message || error);
    res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
  }
}
