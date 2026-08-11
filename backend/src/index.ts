import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { logger } from './core/logger';
import { errorHandler } from './core/errorHandler';
import { connectToDatabase } from './database/connection';
import { redisClient } from './database/redis';
import { minioClient } from './database/minio';
import { setupRoutes } from './routes';
import { wsManager } from './core/websocket';
import {
  securityMiddleware,
  xssProtectionHeaders,
  sqlInjectionProtection,
  requestSanitization,
} from './middleware/security';
import {
  tracingMiddleware,
  requestMetricsMiddleware,
  prometheusEndpoint,
  startMetricsCollection,
} from './middleware/observability';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['https://ventrieeleads.qd.je'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    maxAge: 86400,
  }),
);

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.MAX_CONCURRENT_JOBS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Search rate limit exceeded.' },
});

const auditLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Audit rate limit exceeded.' },
});

app.use('/api/', generalLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/audit', auditLimiter);

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Security middleware
app.use(securityMiddleware);
app.use(xssProtectionHeaders);
app.use(sqlInjectionProtection);
app.use(requestSanitization);

// Observability middleware
app.use(tracingMiddleware);
app.use(requestMetricsMiddleware);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (duration > 5000) {
      logger.warn('Slow request detected', logData);
    }

    if (res.statusCode >= 400) {
      logger.error('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
});

app.get('/health', async (req, res) => {
  const checks: Record<string, string> = {};

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('SELECT 1');
    checks.database = 'healthy';
    await pool.end();
  } catch {
    checks.database = 'unhealthy';
  }

  try {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    await client.ping();
    checks.redis = 'healthy';
    await client.quit();
  } catch {
    checks.redis = 'unhealthy';
  }

  checks.websocket = 'healthy';

  const allHealthy = Object.values(checks).every((s) => s === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    checks,
    websocketClients: wsManager.getClientCount(),
  });
});

app.use('/api', setupRoutes());

// Prometheus metrics endpoint
app.get('/metrics', prometheusEndpoint);

app.use(errorHandler);

wsManager.initialize(server);

async function startServer(): Promise<void> {
  try {
    await connectToDatabase();
    await redisClient.connect();
    await minioClient.initialize();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`WebSocket: ws://localhost:${PORT}/ws`);
      logger.info(`Metrics: http://localhost:${PORT}/metrics`);
      startMetricsCollection();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    wsManager.shutdown();
    await redisClient.quit();
  } catch (e) {
    logger.error('Error during shutdown:', e);
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
