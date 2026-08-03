# Deployment Guide

## Prerequisites

- Docker 24.0+
- Docker Compose v2.20+
- 4GB+ RAM (8GB recommended)
- 20GB+ disk space
- Domain name with DNS configured
- SSL certificate (or use Certbot)

## Docker Compose Setup

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `nginx` | nginx:alpine | 80 (80/443) | Reverse proxy, rate limiting, SSL |
| `frontend` | Next.js build | 3000 (internal) | React frontend |
| `backend` | Express build | 8000 (internal) | API server |
| `task-enqueuer` | Python build | 8002 (internal) | REST → Redis queue bridge |
| `celery-worker` | Python build | — | scrape, audit, process queues |
| `celery-search` | Python build | — | search queue |
| `celery-research` | Python build | — | research queue |
| `celery-beat` | Python build | — | Scheduled task scheduler |
| `postgres` | postgres:16-alpine | 5432 (internal) | Primary database |
| `redis` | redis:7-alpine | 6379 (internal) | Cache, queue, pub/sub |
| `minio` | minio/minio:latest | 9000, 9001 | Object storage |

### Quick Start

```bash
# Clone repository
git clone <repo-url> leads
cd leads

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f celery-worker
```

### Production Start

```bash
# Build for production
docker compose -f docker-compose.yml up -d --build

# Verify all services are healthy
docker compose ps

# Run database migrations (if needed)
docker compose exec backend npm run db:migrate

# Create initial admin user
docker compose exec backend npm run create-admin
```

## Environment Variables Reference

### Backend (.env)

```bash
# ── Core ────────────────────────────────────────────────
NODE_ENV=production
PORT=8000
DOMAIN=ventrieeleads.qd.je

# ── Database ────────────────────────────────────────────
DATABASE_URL=postgresql://leads:leads_pass@postgres:5432/leads
DB_HOST=postgres
DB_PORT=5432
DB_NAME=leads
DB_USER=leads
DB_PASSWORD=leads_pass
DB_SSL=false

# ── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# ── MinIO ───────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_BUCKET_LEADS=leads
MINIO_BUCKET_SCREENSHOTS=screenshots
MINIO_BUCKET_LOGOS=logos
MINIO_BUCKET_FILES=files

# ── JWT ─────────────────────────────────────────────────
JWT_SECRET=your-64-char-random-secret-here
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# ── CORS ────────────────────────────────────────────────
CORS_ORIGINS=http://localhost,http://localhost:3000,https://ventrieeleads.qd.je

# ── AI Providers ────────────────────────────────────────
AI_PROVIDER=ollama
AI_MODEL=llama3
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
GEMINI_API_KEY=...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
ANTHROPIC_API_KEY=...
OLLAMA_URL=http://host.docker.internal:11434
AI_PRIMARY_PROVIDER=ollama
AI_FALLBACK_ENABLED=true

# ── Task Enqueuer ───────────────────────────────────────
TASK_ENQUEUER_URL=http://task-enqueuer:8002

# ── Google Maps (Optional) ─────────────────────────────
GOOGLE_MAPS_API_KEY=...

# ── Rate Limiting ───────────────────────────────────────
MAX_CONCURRENT_JOBS=100
MAX_UPLOAD_SIZE=10485760

# ── CSRF ────────────────────────────────────────────────
CSRF_SECRET=your-csrf-secret-here

# ── Timezone ────────────────────────────────────────────
TIMEZONE=Asia/Dubai

# ── Logging ─────────────────────────────────────────────
LOG_LEVEL=info
```

### Frontend (.env)

```bash
NEXT_PUBLIC_API_URL=http://localhost/api
```

### Nginx

The nginx configuration is in `nginx/nginx.conf`. Key settings:

- Worker processes: auto
- Worker connections: 4096
- Gzip compression enabled
- Rate limiting zones: general (20r/s), search (5r/s), audit (2r/s)
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- Upstream keepalive: 32 connections
- Client max body size: 10MB

## Domain Configuration

### DNS Records

```
Type    Name                    Value
A       ventrieeleads.qd.je     <server-ip>
AAAA    ventrieeleads.qd.je     <server-ipv6>
CNAME   www.ventrieeleads.qd.je ventrieeleads.qd.je
```

### Nginx Server Block

Update `nginx/nginx.conf` for production:

```nginx
server {
    listen 80;
    server_name ventrieeleads.qd.je;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ventrieeleads.qd.je;

    ssl_certificate /etc/letsencrypt/live/ventrieeleads.qd.je/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ventrieeleads.qd.je/privkey.pem;

    # ... rest of config
}
```

## SSL/TLS Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
apt install certbot

# Obtain certificate
certbot certonly --standalone -d ventrieeleads.qd.je -d www.ventrieeleads.qd.je

# Certificates are at:
# /etc/letsencrypt/live/ventrieeleads.qd.je/fullchain.pem
# /etc/letsencrypt/live/ventrieeleads.qd.je/privkey.pem

# Add to docker-compose.yml volumes for nginx:
# - /etc/letsencrypt:/etc/letsencrypt:ro

# Auto-renew
certbot renew --dry-run
```

### Option 2: Self-Signed (Development)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt
```

### SSL Configuration

Add to nginx.conf inside the HTTPS server block:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;
```

## Database Initialization

### Automatic

The database is initialized automatically on first run via `backend/init.sql` mounted to `/docker-entrypoint-initdb.d/`.

### Manual

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U leads -d leads

# Run init script
docker compose exec postgres psql -U leads -d leads -f /docker-entrypoint-initdb.d/init.sql
```

### Create Admin User

```bash
docker compose exec backend node -e "
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function createAdmin() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const password = await bcrypt.hash('admin123', 12);
  const workspaceResult = await pool.query(
    \"INSERT INTO workspaces (name, slug) VALUES ('Admin Workspace', 'admin') RETURNING id\"
  );
  const result = await pool.query(
    \`INSERT INTO users (email, name, hashed_password, role, workspace_id, is_active, email_verified)
     VALUES ('admin@example.com', 'Admin', '\${password}', 'super_admin', '\${workspaceResult.rows[0].id}', true, true)
     RETURNING id, email, role\`
  );
  console.log('Admin created:', result.rows[0]);
  await pool.end();
}
createAdmin();
"
```

## Backup and Restore

### Database Backup

```bash
# Full backup
docker compose exec postgres pg_dump -U leads leads > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec postgres pg_dump -U leads leads | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Automated daily backup (add to crontab)
0 2 * * * docker compose -f /path/to/docker-compose.yml exec -T postgres pg_dump -U leads leads | gzip > /backups/leads_$(date +\%Y\%m\%d).sql.gz
```

### Database Restore

```bash
# From SQL file
cat backup.sql | docker compose exec -T postgres psql -U leads -d leads

# From compressed backup
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U leads -d leads
```

### MinIO Backup

```bash
# Install mc (MinIO Client)
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
mv mc /usr/local/bin/

# Configure
mc alias set leads http://localhost:9000 minioadmin minioadmin123

# Backup bucket
mc mirror leads/leads /backups/minio/leads/

# Restore
mc mirror /backups/minio/leads/ leads/leads/
```

### Redis Backup

```bash
# Create backup
docker compose exec redis redis-cli BGSAVE

# Copy dump
docker compose cp redis:/data/dump.rdb /backups/redis/

# Restore
docker compose cp /backups/redis/dump.rdb redis:/data/dump.rdb
docker compose restart redis
```

## Monitoring Setup

### Health Checks

```bash
# Backend health
curl http://localhost/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "version": "3.0.0",
#   "checks": { "database": "healthy", "redis": "healthy", "websocket": "healthy" },
#   "websocketClients": 5
# }
```

### Prometheus Metrics

```bash
# Metrics endpoint
curl http://localhost/metrics

# Metrics include:
# - http_requests_total (counter)
# - http_request_duration_ms (histogram)
# - http_errors_total (counter)
# - db_queries_total (counter)
# - db_query_duration_ms (histogram)
# - queue_length (gauge)
# - worker_active (gauge)
# - ai_requests_total (counter)
# - ai_cost_usd_total (counter)
```

### Docker Stats

```bash
# Resource usage
docker stats

# Specific service
docker stats backend
```

### Log Management

```bash
# View logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail 100 backend

# Since timestamp
docker compose logs --since 2024-01-15T10:00:00 backend

# Logs are rotated: max 10MB, 3 files per service
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U leads -d leads

# Common fix: Reset database
docker compose down postgres
docker volume rm leads_postgres-data
docker compose up -d postgres
```

#### 2. Redis Connection Failed

```bash
# Check Redis is running
docker compose ps redis

# Test connection
docker compose exec redis redis-cli ping

# Should return: PONG
```

#### 3. MinIO Not Initialized

```bash
# Check MinIO logs
docker compose logs minio

# Manually create buckets
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker compose exec minio mc mb local/leads local/screenshots local/logos local/files
```

#### 4. Celery Worker Not Processing Tasks

```bash
# Check worker status
docker compose ps celery-worker celery-search celery-research

# View worker logs
docker compose logs celery-worker

# Restart workers
docker compose restart celery-worker celery-search celery-research
```

#### 5. Port Already in Use

```bash
# Find process on port
lsof -i :80
lsof -i :3000
lsof -i :8000

# Stop conflicting service
sudo systemctl stop nginx  # if system nginx is running
```

#### 6. Memory Issues

```bash
# Check container memory usage
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Increase memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

#### 7. SSL Certificate Issues

```bash
# Verify certificate
openssl x509 -in /etc/letsencrypt/live/ventrieeleads.qd.je/fullchain.pem -text -noout

# Renew certificate
certbot renew --force-renewal

# Reload nginx
docker compose exec nginx nginx -s reload
```

### Debugging

```bash
# Enter container shell
docker compose exec backend sh
docker compose exec postgres psql -U leads

# Check environment variables
docker compose exec backend env

# Test API directly
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Performance Tuning

```bash
# PostgreSQL tuning (add to init.sql or docker-compose.yml)
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';

# Redis tuning (in docker-compose.yml command)
redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

# Nginx tuning (in nginx.conf)
worker_connections 8192;
keepalive_timeout 65;
client_max_body_size 50m;
```
