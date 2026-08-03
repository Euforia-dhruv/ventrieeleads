import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../core/logger';
import { redisClient } from '../database/redis';

// ── Constants ───────────────────────────────────────────────
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '10485760'); // 10MB

const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
};

const DANGEROUS_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
  /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/gi,
  /((\%60)|`)/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:/gi,
  /on\w+\s*=/gi,
  /expression\s*\(/gi,
  /(\%\x00)|\x00/g,
  /\/etc\/passwd/gi,
  /\/etc\/shadow/gi,
  /\/proc\/self/gi
];

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FETCH|DECLARE|TRUNCATE)\b)/gi,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
  /['"]\s*;\s*(DROP|DELETE|INSERT|UPDATE|ALTER)/gi,
  /'\s*OR\s+'[^']*'='/gi,
  /--\s*$/gm,
  /\/\*[\s\S]*?\*\//g,
  /\bWAITFOR\b\s+\bDELAY\b/gi,
  /\bBENCHMARK\s*\(/gi,
  /\bSLEEP\s*\(/gi
];

// ── CSRF Protection ─────────────────────────────────────────
function generateCsrfToken(): string {
  const randomBytes = crypto.randomBytes(CSRF_TOKEN_LENGTH);
  const timestamp = Date.now().toString(16);
  const payload = randomBytes.toString('hex') + timestamp;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) return false;

  const timestampHex = payload.slice(-16);
  const timestamp = parseInt(timestampHex, 16);
  const maxAge = 60 * 60 * 1000; // 1 hour
  return Date.now() - timestamp < maxAge;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const isApiCall = req.path.startsWith('/api/');

  if (isSafeMethod && isApiCall) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    res.setHeader('X-CSRF-Token', token);
    next();
    return;
  }

  if (isSafeMethod) {
    next();
    return;
  }

  const headerToken = req.headers[CSRF_HEADER_NAME] as string;
  const bodyToken = (req.body as any)?._csrf;
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  const token = headerToken || bodyToken || cookieToken;

  if (!token || !verifyCsrfToken(token)) {
    logger.warn('CSRF token validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(403).json({ success: false, message: 'CSRF token invalid or expired' });
    return;
  }

  next();
}

// ── XSS Protection Headers ──────────────────────────────────
export function xssProtectionHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

// ── Content Security Policy Headers ─────────────────────────
export function cspHeaders(req: Request, res: Response, next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self'" + (isProduction ? '' : " 'unsafe-eval' 'unsafe-inline'"),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.googleapis.com wss: ws:",
    "media-src 'self'",
    "object-src 'none'",
    "child-src 'self' blob:",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "manifest-src 'self'"
  ];

  if (!isProduction) {
    directives.push("connect-src 'self' http://localhost:* ws://localhost:*");
  }

  const csp = directives.join('; ');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Security-Policy', csp);

  next();
}

// ── SQL Injection Protection (Parameter Validation) ─────────
export function sqlInjectionProtection(req: Request, res: Response, next: NextFunction): void {
  const checkValue = (value: any, path: string): boolean => {
    if (typeof value !== 'string') return true;

    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        logger.warn('Potential SQL injection attempt detected', {
          path,
          value: value.substring(0, 100),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return false;
      }
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        logger.warn('Potentially dangerous pattern detected', {
          path,
          value: value.substring(0, 100),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return false;
      }
    }

    return true;
  };

  const checkObject = (obj: any, prefix: string): boolean => {
    if (!obj || typeof obj !== 'object') return true;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = `${prefix}.${key}`;
      if (typeof value === 'string') {
        if (!checkValue(value, fullPath)) {
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
        if (!checkObject(value, fullPath)) {
          return false;
        }
      }
    }
    return true;
  };

  if (req.body && !checkObject(req.body, 'body')) {
    res.status(400).json({ success: false, message: 'Request contains invalid characters' });
    return;
  }

  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && !checkValue(value, `query.${key}`)) {
        res.status(400).json({ success: false, message: 'Request contains invalid characters' });
        return;
      }
    }
  }

  if (req.params && !checkObject(req.params, 'params')) {
    res.status(400).json({ success: false, message: 'Request contains invalid characters' });
    return;
  }

  next();
}

// ── File Upload Validation ──────────────────────────────────
export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  maxFiles?: number;
}

const DEFAULT_OPTIONS: FileValidationOptions = {
  maxSize: MAX_FILE_SIZE,
  allowedTypes: [
    ...ALLOWED_UPLOAD_TYPES.image,
    ...ALLOWED_UPLOAD_TYPES.document,
    ...ALLOWED_UPLOAD_TYPES.archive
  ],
  maxFiles: 5
};

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

function getMimeTypeCategory(mimeType: string): string {
  for (const [category, types] of Object.entries(ALLOWED_UPLOAD_TYPES)) {
    if (types.includes(mimeType)) return category;
  }
  return 'unknown';
}

export function fileUploadValidation(options: FileValidationOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.is('multipart/form-data')) {
      next();
      return;
    }

    const files = (req as any).files;
    if (!files) {
      next();
      return;
    }

    const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

    if (fileArray.length === 0) {
      next();
      return;
    }

    if (opts.maxFiles && fileArray.length > opts.maxFiles) {
      res.status(400).json({
        success: false,
        message: `Too many files. Maximum allowed: ${opts.maxFiles}`
      });
      return;
    }

    for (const file of fileArray) {
      if (opts.maxSize && file.size > opts.maxSize) {
        res.status(400).json({
          success: false,
          message: `File "${file.originalname}" exceeds maximum size of ${Math.round(opts.maxSize / 1024 / 1024)}MB`
        });
        return;
      }

      if (opts.allowedTypes && file.mimetype && !opts.allowedTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          message: `File type "${file.mimetype}" is not allowed`
        });
        return;
      }

      if (opts.allowedExtensions) {
        const ext = getFileExtension(file.originalname);
        if (!opts.allowedExtensions.includes(ext)) {
          res.status(400).json({
            success: false,
            message: `File extension ".${ext}" is not allowed`
          });
          return;
        }
      }

      const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'jar', 'msi', 'dll', 'scr', 'com', 'pif'];
      const ext = getFileExtension(file.originalname);
      if (dangerousExtensions.includes(ext)) {
        res.status(400).json({
          success: false,
          message: `File extension ".${ext}" is not allowed for security reasons`
        });
        return;
      }

      if (file.originalname) {
        const sanitizedName = file.originalname
          .replace(/[^\w\s.-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 255);
        file.originalname = sanitizedName;
      }

      const category = getMimeTypeCategory(file.mimetype || '');
      logger.info('File upload validated', {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        category,
        ip: req.ip
      });
    }

    next();
  };
}

// ── Request Sanitization ────────────────────────────────────
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/\0/g, '')
    .trim();
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

export function requestSanitization(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.query)) {
      sanitized[sanitizeString(key)] = typeof value === 'string' ? sanitizeString(value) : value;
    }
    req.query = sanitized;
  }

  if (req.params && typeof req.params === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.params)) {
      sanitized[sanitizeString(key)] = typeof value === 'string' ? sanitizeString(value) : value;
    }
    req.params = sanitized;
  }

  next();
}

// ── Input Length Validation ─────────────────────────────────
export function inputLengthValidation(maxLengths: Record<string, number>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    for (const [field, maxLen] of Object.entries(maxLengths)) {
      const value = req.body[field];
      if (typeof value === 'string' && value.length > maxLen) {
        res.status(400).json({
          success: false,
          message: `Field "${field}" exceeds maximum length of ${maxLen} characters`
        });
        return;
      }
    }

    next();
  };
}

// ── IP Allowlist/Blocklist ──────────────────────────────────
export function ipFilter(options: { allow?: string[]; block?: string[] }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || '';

    if (options.block && options.block.includes(clientIp)) {
      logger.warn('Blocked IP attempted access', { ip: clientIp, path: req.path });
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (options.allow && options.allow.length > 0 && !options.allow.includes(clientIp)) {
      logger.warn('IP not in allowlist', { ip: clientIp, path: req.path });
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    next();
  };
}

// ── Request Size Limiter ────────────────────────────────────
export function requestSizeLimiter(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        message: `Request body exceeds maximum size of ${Math.round(maxSizeBytes / 1024)}KB`
      });
      return;
    }

    next();
  };
}

// ── Combined Security Middleware ─────────────────────────────
export function securityMiddleware(req: Request, res: Response, next: NextFunction): void {
  xssProtectionHeaders(req, res, () => {
    cspHeaders(req, res, () => {
      sqlInjectionProtection(req, res, () => {
        requestSanitization(req, res, next);
      });
    });
  });
}

export { ALLOWED_UPLOAD_TYPES, DANGEROUS_PATTERNS, SQL_INJECTION_PATTERNS, CSRF_TOKEN_LENGTH, CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
