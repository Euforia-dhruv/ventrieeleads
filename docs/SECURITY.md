# Security Guide

## Authentication Mechanisms

### JWT Token Authentication

- **Algorithm**: HMAC-SHA256
- **Access token expiry**: 7 days (90 days with "remember me")
- **Refresh token expiry**: 30 days (180 days with "remember me")
- **Token payload**: `{id, email, role, workspace_id}`
- **Signing secret**: `JWT_SECRET` environment variable

### Token Lifecycle

1. **Generation**: Tokens created on login/register/magic-link/OAuth
2. **Storage**: Token hashes (SHA-256) stored in `sessions` table
3. **Validation**: Each request verifies JWT signature, checks Redis revocation list, queries user from DB
4. **Refresh**: Old session revoked, new session created
5. **Revocation**: Token hash added to Redis (`revoked:<hash>`) for 7 days, session marked `is_revoked = true`

### Password Security

- **Hashing**: bcrypt with configurable rounds (default: 12)
- **Minimum length**: 8 characters
- **Password history**: Not enforced (add if needed)
- **Account lockout**: Not implemented (add if needed)

### Magic Link Authentication

1. User requests magic link with email
2. Server generates random 32-byte token, hashes it, stores in `magic_link_tokens` with 15-minute expiry
3. Token sent via email (logged in dev)
4. User clicks link, verifies token
5. If user exists, session created; if not, 404 returned
6. Token marked as used (one-time use)

### OAuth Authentication

- **Supported providers**: Google, GitHub
- **Flow**: Client-side OAuth → callback to `/api/auth/oauth/callback` with provider tokens
- **Account linking**: If email exists, OAuth connection linked to existing account
- **New accounts**: Workspace + owner role created automatically

### API Key Authentication

- **Format**: `sk-` prefix + 8-char prefix + 32-char random suffix
- **Storage**: bcrypt hash in `api_keys` table
- **Header**: `X-API-Key: sk-...`
- **Permissions**: Optional scope to specific permissions
- **Expiry**: Optional `expires_at` timestamp
- **Usage tracking**: `last_used_at` updated on each use

## Authorization Model

### Role-Based Access Control (RBAC)

| Role | Description | Permissions |
|------|-------------|------------|
| `super_admin` | Platform administrator | All permissions, bypass all checks |
| `owner` | Workspace creator | All workspace permissions, bypass all checks |
| `admin` | Workspace admin | Most permissions |
| `member` | Standard user | Limited permissions |
| `viewer` | Read-only | Read-only access |

### Permission System

Permissions are stored in `permissions` table, assigned to roles via `role_permissions`, and checked via `user_workspace_roles`.

```typescript
// Middleware check
requirePermission('leads.create')
```

### Authorization Checks

1. **Authentication**: `authenticate` middleware validates JWT/API key
2. **Role check**: `requireRole('super_admin', 'admin')` verifies user role
3. **Permission check**: `requirePermission('leads.create')` queries database
4. **Workspace scoping**: All queries use `req.workspaceId` to scope data

### Bypass Rules

- `super_admin` and `owner` roles bypass all permission checks
- `super_admin` can access any workspace's data
- API keys inherit the creating user's role and permissions

## API Key Management

### Creation

```typescript
POST /api/api-keys
{
  "name": "Production Key",
  "permissions": ["leads.read", "leads.create"],
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Security Properties

- Full key shown only once on creation
- Key hashed with bcrypt before storage
- Prefix stored for lookup (first 8 chars)
- Optional expiry timestamp
- Optional permission scope

### Revocation

```typescript
DELETE /api/api-keys/:id
```

Immediate revocation; key hash checked on every request.

### Best Practices

- Use minimal permissions per key
- Set expiry dates for temporary keys
- Rotate keys periodically
- Never expose keys in client-side code
- Store keys in environment variables or secret managers

## Rate Limiting

### Application Level (express-rate-limit)

| Endpoint | Window | Limit | Response |
|----------|--------|-------|----------|
| `/api/*` | 1 min | 100 requests | 429 |
| `/api/search` | 1 min | 10 requests | 429 |
| `/api/audit` | 1 min | 5 requests | 429 |

### Nginx Level

| Location | Rate | Burst |
|----------|------|-------|
| `/` (frontend) | 20 req/s | 10 |
| `/api/` | 20 req/s | 20 |
| `/api/search` | 5 req/s | 5 |
| `/api/audit` | 2 req/s | 3 |

### Rate Limit Headers

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1705312800
```

## CSRF Protection

### Implementation

- Token generated using HMAC-SHA256 with random bytes + timestamp
- Token set in `_csrf` cookie (non-HttpOnly) and `X-CSRF-Token` response header
- Token sent back in `x-csrf-token` header, `_csrf` body field, or `_csrf` cookie
- Token valid for 1 hour

### Configuration

```typescript
// In security.ts
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
```

### Usage

```typescript
// Apply to specific routes
router.post('/items', csrfProtection, createItem);
```

### Protection Scope

- Safe methods (GET, HEAD, OPTIONS) are exempt
- API calls (`/api/*`) use CSRF cookies
- Non-API calls (form submissions) use standard CSRF

## XSS Protection

### Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
X-Permitted-Cross-Domain-Policies: none
X-DNS-Prefetch-Control: off
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

### Request Sanitization

The `requestSanitization` middleware strips:

- `<script>...</script>` tags
- `<iframe>...</iframe>` tags
- `<object>`, `<embed>`, `<link>`, `<meta>` tags
- Event handlers (`onload=`, `onclick=`, etc.)
- `javascript:`, `vbscript:`, `data:` URLs
- `expression()` CSS
- Null bytes

### Input Sanitization Function

```typescript
sanitizeString(input: string): string
```

Applied to all `req.body`, `req.query`, and `req.params` values.

## SQL Injection Protection

### Pattern Detection

The `sqlInjectionProtection` middleware detects:

- SQL keywords: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `EXEC`, `UNION`, etc.
- Boolean injection: `OR 1=1`, `AND 1=1`
- Comment injection: `--`, `/* */`
- Time-based: `WAITFOR DELAY`, `SLEEP()`, `BENCHMARK()`

### Parameterized Queries

All database queries use parameterized queries (pg driver):

```typescript
// Safe
pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// Never do this
pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### Dangerous Pattern Detection

Also detects:
- Path traversal: `/etc/passwd`, `/proc/self`
- Null bytes
- HTML tags in non-HTML contexts

## XSS Protection

### Content Security Policy

```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline' (dev only)
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: https: blob:
connect-src 'self' https://*.googleapis.com wss: ws:
media-src 'self'
object-src 'none'
child-src 'self' blob:
worker-src 'self' blob:
form-action 'self'
frame-ancestors 'none'
base-uri 'self'
manifest-src 'self'
```

### Response Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Secrets Management

### Environment Variables

All secrets stored in environment variables:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing key |
| `CSRF_SECRET` | CSRF token signing |
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `MINIO_ACCESS_KEY` | MinIO access |
| `MINIO_SECRET_KEY` | MinIO secret |
| `OPENAI_API_KEY` | OpenAI API |
| `GEMINI_API_KEY` | Gemini API |
| `ANTHROPIC_API_KEY` | Anthropic API |
| `GOOGLE_MAPS_API_KEY` | Google Maps API |

### Docker Secrets

For production, use Docker secrets:

```yaml
services:
  backend:
    secrets:
      - jwt_secret
      - db_password
    environment:
      JWT_SECRET_FILE=/run/secrets/jwt_secret
      DATABASE_URL_FILE=/run/secrets/db_url

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  db_password:
    file: ./secrets/db_password.txt
```

### Git Protection

- `.env` files in `.gitignore`
- Never commit secrets to version control
- Use `.env.example` with placeholder values
- Rotate any accidentally committed secrets immediately

### Secret Rotation

1. Generate new secret
2. Update environment variable
3. Restart affected services
4. Old tokens become invalid (users must re-login)

## Audit Logging

### Implementation

The `AuditLogService` records:

```typescript
interface AuditLog {
  id: string;
  user_id: string;
  workspace_id: string;
  action: string;        // e.g., 'lead.created', 'user.login'
  entity_type: string;   // e.g., 'lead', 'campaign'
  entity_id: string;
  details: any;          // Old/new values, metadata
  ip_address: string;
  user_agent: string;
  created_at: Date;
}
```

### Logged Actions

| Action | Entity | Description |
|--------|--------|-------------|
| `user.login` | user | Successful login |
| `user.register` | user | New user registration |
| `user.logout` | user | User logout |
| `lead.created` | lead | Lead created |
| `lead.updated` | lead | Lead modified |
| `lead.deleted` | lead | Lead soft-deleted |
| `campaign.created` | campaign | Campaign created |
| `search.created` | search | Search job created |
| `api_key.created` | api_key | API key created |
| `api_key.revoked` | api_key | API key revoked |
| `admin.settings_changed` | settings | Admin settings modified |
| `admin.user_role_changed` | user | User role updated |
| `admin.backup_created` | backup | Database backup created |

### Accessing Audit Logs

```typescript
GET /api/admin/logs?user_id=...&action=lead.created&from=2024-01-01&to=2024-01-31
```

### Querying

```typescript
const logs = await auditLogService.query({
  workspace_id: req.workspaceId,
  action: 'lead.created',
  entity_type: 'lead',
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
  limit: 100
});
```

## Session Management

### Session Lifecycle

1. **Creation**: On login/register, session row inserted with token hashes, device info, IP, expiry timestamps
2. **Validation**: Each request validates JWT, checks Redis revocation, verifies session row exists and not revoked
3. **Refresh**: Old session revoked, new session created with new tokens
4. **Revocation**: Single session or all user sessions marked `is_revoked = true`
5. **Expiration**: Sessions expire based on `expires_at` and `refresh_expires_at`

### Session Data

```typescript
interface Session {
  id: string;
  user_id: string;
  token_hash: string;           // SHA-256 of access token
  refresh_token_hash: string;   // SHA-256 of refresh token
  user_agent: string;
  ip_address: string;
  device_name: string;          // Chrome, Firefox, Safari, etc.
  device_type: string;          // desktop, mobile, tablet, bot
  is_revoked: boolean;
  expires_at: Date;
  refresh_expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
}
```

### Security Features

- Token hashes (not plain tokens) stored in database
- Revoked tokens cached in Redis for 7 days
- Device fingerprinting (user agent parsing)
- IP address tracking
- Session count limits (not enforced, add if needed)
- Forced logout on password change

### User-Facing Session Management

```typescript
// List active sessions
GET /api/auth/sessions

// Revoke specific session
DELETE /api/auth/sessions/:id

// Revoke all sessions
POST /api/auth/logout-all
```

## File Upload Security

### Validation

The `fileUploadValidation` middleware enforces:

- **Max file size**: 10MB (configurable via `MAX_UPLOAD_SIZE`)
- **Max files**: 5 per request
- **Allowed MIME types**: JPEG, PNG, GIF, WebP, SVG, PDF, DOC, DOCX, XLS, XLSX, CSV, ZIP, RAR, 7Z
- **Blocked extensions**: exe, bat, cmd, sh, ps1, vbs, js, jar, msi, dll, scr, com, pif

### Filename Sanitization

```typescript
// Original filename sanitized:
// - Remove special characters (keep alphanumeric, spaces, dots, hyphens)
// - Replace spaces with underscores
// - Truncate to 255 characters
```

### Storage

Files stored in MinIO with randomized object names to prevent path traversal.

## Transport Security

### HTTPS

- Production: SSL/TLS via Let's Encrypt or custom certificates
- HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- HTTP → HTTPS redirect via Nginx

### CORS Configuration

```typescript
cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['https://ventrieeleads.qd.je'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  maxAge: 86400
})
```

### Security Headers (Nginx)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

## Input Validation

### Request Size Limits

- Express JSON body: 5MB
- Express URL-encoded: 5MB
- Nginx client_max_body_size: 10MB

### Field Length Validation

```typescript
inputLengthValidation({
  name: 255,
  email: 255,
  password: 128,
  notes: 5000
})
```

### Type Validation

All request body fields are validated for expected types before use in queries.

## Network Security

### IP Filtering

```typescript
ipFilter({
  allow: ['1.2.3.4', '5.6.7.8'],  // Allowlist
  block: ['9.10.11.12']            // Blocklist
})
```

### Nginx Security

```nginx
# Block common attack patterns
location ~* \.(env|git|svn|htaccess|htpasswd)$ {
    deny all;
    return 404;
}
```

### Database Access

- PostgreSQL only accessible from Docker network
- No direct external access
- Connection pooling via `pg.Pool`

### Redis Access

- Redis only accessible from Docker network
- Max memory: 256MB with LRU eviction
- No external access

## Security Monitoring

### Request Logging

Every request logged with:
- Request ID (UUID)
- Method, URL, status code
- Duration (slow requests > 5s flagged)
- IP address, User-Agent
- User ID (if authenticated)

### Error Logging

Errors logged with:
- Full stack trace (dev only)
- Request context
- User context
- IP and User-Agent

### Security Events

- Failed login attempts
- CSRF validation failures
- SQL injection attempts
- XSS attempts
- Rate limit violations

## Security Checklist

### Before Deployment

- [ ] `JWT_SECRET` is a strong random string (64+ chars)
- [ ] `CSRF_SECRET` is set
- [ ] Database password is strong
- [ ] MinIO credentials changed from defaults
- [ ] `.env` files not committed to git
- [ ] CORS origins configured correctly
- [ ] SSL/TLS certificates valid
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Logging to secure location

### Regular Maintenance

- [ ] Rotate JWT_SECRET periodically
- [ ] Rotate API keys
- [ ] Review audit logs
- [ ] Update dependencies for security patches
- [ ] Review user access and roles
- [ ] Backup database regularly
- [ ] Monitor for unusual traffic patterns
