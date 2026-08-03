import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../core/logger';
import { redisClient } from '../database/redis';
import { getPool } from '../database/connection';

// ── In-Memory Metric Store ──────────────────────────────────
interface MetricBucket {
  name: string;
  help: string;
  type: 'counter' | 'histogram' | 'gauge';
  values: Map<string, number>;
  buckets?: number[];
  sum: number;
  count: number;
}

class MetricStore {
  private metrics: Map<string, MetricBucket> = new Map();

  private getOrCreate(name: string, help: string, type: MetricBucket['type'], buckets?: number[]): MetricBucket {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        help,
        type,
        values: new Map(),
        buckets,
        sum: 0,
        count: 0
      });
    }
    return this.metrics.get(name)!;
  }

  incCounter(name: string, labels: Record<string, string>, value: number = 1): void {
    const metric = this.getOrCreate(name, '', 'counter');
    const key = this.labelKey(labels);
    metric.values.set(key, (metric.values.get(key) || 0) + value);
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.getOrCreate(name, '', 'histogram', [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]);
    const key = this.labelKey(labels);
    metric.values.set(key, (metric.values.get(key) || 0) + value);
    metric.sum += value;
    metric.count += 1;

    if (metric.buckets) {
      for (const boundary of metric.buckets) {
        if (value <= boundary) {
          const bucketKey = `le="${boundary}"`;
          const fullKey = key ? `${key},${bucketKey}` : bucketKey;
          metric.values.set(fullKey, (metric.values.get(fullKey) || 0) + 1);
        }
      }
      const infKey = key ? `${key},le="+Inf"` : 'le="+Inf"';
      metric.values.set(infKey, (metric.values.get(infKey) || 0) + 1);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.getOrCreate(name, '', 'gauge');
    const key = this.labelKey(labels);
    metric.values.set(key, value);
  }

  private labelKey(labels: Record<string, string>): string {
    const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([k, v]) => `${k}="${v}"`).join(',');
  }

  toPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        let cumulative = 0;
        const sortedKeys = [...metric.values.keys()].sort();
        const bucketKeys = sortedKeys.filter(k => k.includes('le='));
        const otherKeys = sortedKeys.filter(k => !k.includes('le='));

        for (const key of otherKeys) {
          lines.push(`${metric.name}{${key}} ${metric.values.get(key)}`);
        }

        for (const key of bucketKeys) {
          const val = metric.values.get(key) || 0;
          cumulative += val;
          const labelStr = key.replace(/le="[^"]*"/, '').replace(/,$/, '').replace(/^$/, '');
          const suffix = labelStr ? `,${labelStr}` : '';
          lines.push(`${metric.name}_bucket{le=${key.split('le=')[1].replace(/"/g, '')}${suffix}} ${cumulative}`);
        }

        lines.push(`${metric.name}_sum ${metric.sum}`);
        lines.push(`${metric.name}_count ${metric.count}`);
      } else {
        for (const [key, value] of metric.values.entries()) {
          lines.push(`${metric.name}{${key}} ${value}`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }

  getSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [name, metric] of this.metrics.entries()) {
      snapshot[name] = {
        type: metric.type,
        values: Object.fromEntries(metric.values),
        sum: metric.sum,
        count: metric.count
      };
    }
    return snapshot;
  }
}

const store = new MetricStore();

// ── OpenTelemetry-Style Tracing ─────────────────────────────
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp: number; attributes: Record<string, string> }>;
  status: 'ok' | 'error' | 'unset';
}

const activeSpans: Map<string, SpanContext> = new Map();

function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createSpan(operationName: string, parentSpanId?: string): SpanContext {
  const span: SpanContext = {
    traceId: generateId(),
    spanId: generateId(),
    parentSpanId,
    operationName,
    startTime: Date.now(),
    attributes: {},
    events: [],
    status: 'unset'
  };
  activeSpans.set(span.spanId, span);
  return span;
}

export function finishSpan(span: SpanContext, error?: Error): void {
  span.attributes['duration_ms'] = Date.now() - span.startTime;
  span.attributes['end_time'] = Date.now();

  if (error) {
    span.status = 'error';
    span.attributes['error.message'] = error.message;
    span.attributes['error.name'] = error.name;
    addSpanEvent(span, 'exception', {
      'exception.type': error.name,
      'exception.message': error.message
    });
  } else {
    span.status = 'ok';
  }

  activeSpans.delete(span.spanId);

  logger.debug('Span completed', {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    operation: span.operationName,
    duration: `${span.attributes['duration_ms']}ms`,
    status: span.status,
    attributes: span.attributes,
    events: span.events
  });
}

function addSpanEvent(span: SpanContext, name: string, attributes: Record<string, string> = {}): void {
  span.events.push({ name, timestamp: Date.now(), attributes });
}

export function withSpan<T>(operationName: string, fn: (span: SpanContext) => T | Promise<T>): Promise<T> {
  return withSpanAsync(operationName, fn as (span: SpanContext) => Promise<T>);
}

async function withSpanAsync<T>(operationName: string, fn: (span: SpanContext) => Promise<T>): Promise<T> {
  const span = createSpan(operationName);
  try {
    const result = await fn(span);
    finishSpan(span);
    return result;
  } catch (error) {
    finishSpan(span, error as Error);
    throw error;
  }
}

// ── Request Tracing Middleware ───────────────────────────────
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = req.headers['x-trace-id'] as string || generateId();
  const spanId = generateId();
  const parentSpanId = req.headers['x-parent-span-id'] as string;

  const span: SpanContext = {
    traceId,
    spanId,
    parentSpanId,
    operationName: `${req.method} ${req.route?.path || req.path}`,
    startTime: Date.now(),
    attributes: {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.user_agent': req.get('User-Agent') || '',
      'http.remote_addr': req.ip || '',
      'http.scheme': req.protocol,
      'http.host': req.get('Host') || ''
    },
    events: [],
    status: 'unset'
  };

  activeSpans.set(spanId, span);

  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Span-ID', spanId);

  (req as any).traceId = traceId;
  (req as any).spanId = spanId;
  (req as any).span = span;

  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    span.attributes['http.status_code'] = res.statusCode;
    span.attributes['http.response_time_ms'] = Date.now() - span.startTime;

    if (res.statusCode >= 500) {
      span.status = 'error';
    } else if (res.statusCode >= 400) {
      span.status = 'error';
    } else {
      span.status = 'ok';
    }

    activeSpans.delete(spanId);

    logger.info('Request traced', {
      traceId,
      spanId,
      parentSpanId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - span.startTime}ms`,
      span: {
        operation: span.operationName,
        status: span.status,
        attributes: span.attributes
      }
    });

    return originalEnd.apply(res, args as any);
  };

  next();
}

// ── Structured Logging Middleware ────────────────────────────
export function structuredLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || generateId();
  const startTime = Date.now();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: parseInt(res.getHeader('Content-Length') as string) || 0,
      userId: (req as any).user?.id,
      workspaceId: (req as any).workspaceId,
      traceId: (req as any).traceId,
      spanId: (req as any).spanId
    };

    if (duration > 5000) {
      logger.warn('Slow request detected', logEntry);
    }

    if (res.statusCode >= 500) {
      logger.error('Request error', logEntry);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', logEntry);
    }

    return originalJson(body);
  };

  const originalSend = res.send.bind(res);
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    if (!res.headersSent) {
      const logEntry = {
        requestId,
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: typeof body === 'string' ? body.length : 0,
        userId: (req as any).user?.id,
        workspaceId: (req as any).workspaceId,
        traceId: (req as any).traceId
      };

      if (res.statusCode >= 500) {
        logger.error('Request error', logEntry);
      }
    }

    return originalSend(body);
  };

  next();
}

// ── Request Metrics Middleware ───────────────────────────────
export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const route = req.route?.path || req.path;

  store.incCounter('http_requests_total', { method, route, status: 'started' });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode.toString();
    const statusClass = status.startsWith('2') ? '2xx' : status.startsWith('3') ? '3xx' : status.startsWith('4') ? '4xx' : '5xx';

    store.incCounter('http_requests_total', { method, route, status: statusClass });
    store.observeHistogram('http_request_duration_ms', duration, { method, route, status: statusClass });
    store.setGauge('http_request_size_bytes', parseInt(req.get('Content-Length') || '0'), { method, route });
    store.setGauge('http_response_size_bytes', parseInt(res.getHeader('Content-Length') as string || '0'), { method, route });

    if (res.statusCode >= 400) {
      store.incCounter('http_errors_total', { method, route, status: statusClass });
    }

    if (duration > 5000) {
      store.incCounter('http_slow_requests_total', { method, route, status: statusClass });
    }
  });

  next();
}

// ── Queue Metrics Collector ─────────────────────────────────
export class QueueMetricsCollector {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(intervalMs: number = 30000): void {
    this.collect();
    this.interval = setInterval(() => this.collect(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async collect(): Promise<void> {
    try {
      const client = redisClient.getClient();
      const queueKeys = await client.keys('queue:*');

      for (const key of queueKeys) {
        const queueLength = await client.lLen(key);
        const queueName = key.replace('queue:', '');

        store.setGauge('queue_length', queueLength, { queue: queueName });

        const processing = await client.sMembers(`queue:${queueName}:processing`);
        store.setGauge('queue_processing', processing.length, { queue: queueName });

        const delayed = await client.zCard(`queue:${queueName}:delayed`);
        store.setGauge('queue_delayed', delayed, { queue: queueName });

        const failed = await client.sMembers(`queue:${queueName}:failed`);
        store.setGauge('queue_failed', failed.length, { queue: queueName });
      }

      const workers = await client.keys('worker:*');
      for (const workerKey of workers) {
        const workerInfo = await client.hGetAll(workerKey);
        const workerId = workerKey.replace('worker:', '');
        store.setGauge('worker_active', workerInfo.status === 'active' ? 1 : 0, { worker: workerId });
        store.setGauge('worker_tasks_completed', parseInt(workerInfo.tasks_completed || '0'), { worker: workerId });
        store.setGauge('worker_tasks_failed', parseInt(workerInfo.tasks_failed || '0'), { worker: workerId });
      }
    } catch (error) {
      logger.debug('Queue metrics collection failed:', error);
    }
  }
}

// ── Database Query Metrics ──────────────────────────────────
export class DatabaseMetricsCollector {
  private static queryCount: number = 0;
  private static slowQueryCount: number = 0;
  private static errorCount: number = 0;

  static recordQuery(duration: number, operation: string, table: string, success: boolean): void {
    this.queryCount++;
    store.incCounter('db_queries_total', { operation, table, success: success ? 'true' : 'false' });
    store.observeHistogram('db_query_duration_ms', duration, { operation, table });

    if (duration > 1000) {
      this.slowQueryCount++;
      store.incCounter('db_slow_queries_total', { operation, table });
      logger.warn('Slow database query detected', { operation, table, duration: `${duration}ms` });
    }

    if (!success) {
      this.errorCount++;
      store.incCounter('db_query_errors_total', { operation, table });
    }
  }

  static recordPoolStats(total: number, idle: number, waiting: number): void {
    store.setGauge('db_pool_total', total);
    store.setGauge('db_pool_idle', idle);
    store.setGauge('db_pool_waiting', waiting);
  }

  static getStats(): { queryCount: number; slowQueryCount: number; errorCount: number } {
    return {
      queryCount: this.queryCount,
      slowQueryCount: this.slowQueryCount,
      errorCount: this.errorCount
    };
  }
}

export function instrumentedQuery(pool: any, query: string, params?: any[]): Promise<any> {
  const startTime = Date.now();
  const operation = query.trim().split(/\s+/)[0].toUpperCase();
  const tableMatch = query.match(/(?:FROM|INTO|UPDATE|JOIN)\s+(\w+)/i);
  const table = tableMatch ? tableMatch[1] : 'unknown';

  return pool.query(query, params)
    .then((result: any) => {
      const duration = Date.now() - startTime;
      DatabaseMetricsCollector.recordQuery(duration, operation, table, true);
      return result;
    })
    .catch((error: Error) => {
      const duration = Date.now() - startTime;
      DatabaseMetricsCollector.recordQuery(duration, operation, table, false);
      throw error;
    });
}

// ── AI Usage Metrics ────────────────────────────────────────
export class AIMetricsCollector {
  static recordRequest(provider: string, model: string, tokensIn: number, tokensOut: number, duration: number, success: boolean): void {
    store.incCounter('ai_requests_total', { provider, model, success: success ? 'true' : 'false' });
    store.observeHistogram('ai_request_duration_ms', duration, { provider, model });
    store.incCounter('ai_tokens_input_total', { provider, model }, tokensIn);
    store.incCounter('ai_tokens_output_total', { provider, model }, tokensOut);

    const cost = this.estimateCost(provider, model, tokensIn, tokensOut);
    store.incCounter('ai_cost_usd_total', { provider, model }, cost);

    if (!success) {
      store.incCounter('ai_errors_total', { provider, model });
    }

    logger.info('AI request metrics', { provider, model, tokensIn, tokensOut, duration: `${duration}ms`, success, estimatedCost: cost });
  }

  static estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'openai:gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'openai:gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
      'openai:gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
      'openai:gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
      'openai:gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
      'gemini:gemini-pro': { input: 0.00025 / 1000, output: 0.0005 / 1000 },
      'gemini:gemini-1.5-pro': { input: 0.00125 / 1000, output: 0.005 / 1000 },
      'ollama:llama3': { input: 0, output: 0 }
    };

    const key = `${provider}:${model}`;
    const rates = pricing[key] || { input: 0.002 / 1000, output: 0.006 / 1000 };
    return inputTokens * rates.input + outputTokens * rates.output;
  }
}

// ── Worker Metrics Collector ─────────────────────────────────
export class WorkerMetricsCollector {
  private static workers: Map<string, {
    status: string;
    startedAt: number;
    tasksCompleted: number;
    tasksFailed: number;
    currentTask: string | null;
    memoryUsage: NodeJS.MemoryUsage;
  }> = new Map();

  static registerWorker(workerId: string): void {
    this.workers.set(workerId, {
      status: 'idle',
      startedAt: Date.now(),
      tasksCompleted: 0,
      tasksFailed: 0,
      currentTask: null,
      memoryUsage: process.memoryUsage()
    });

    store.setGauge('worker_status', 1, { worker: workerId, status: 'registered' });
    logger.info('Worker registered', { workerId });
  }

  static updateWorkerStatus(workerId: string, status: string, taskName?: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = status;
      worker.currentTask = taskName || null;
      worker.memoryUsage = process.memoryUsage();
    }

    store.setGauge('worker_status', 1, { worker: workerId, status });
    if (taskName) {
      store.setGauge('worker_task_active', 1, { worker: workerId, task: taskName });
    }
  }

  static recordTaskComplete(workerId: string, taskName: string, duration: number, success: boolean): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      if (success) {
        worker.tasksCompleted++;
      } else {
        worker.tasksFailed++;
      }
      worker.memoryUsage = process.memoryUsage();
    }

    store.incCounter('worker_tasks_total', { worker: workerId, task: taskName, success: success ? 'true' : 'false' });
    store.observeHistogram('worker_task_duration_ms', duration, { worker: workerId, task: taskName });

    if (!success) {
      store.incCounter('worker_task_errors_total', { worker: workerId, task: taskName });
    }
  }

  static collectProcessMetrics(): void {
    const mem = process.memoryUsage();
    store.setGauge('process_memory_rss_bytes', mem.rss);
    store.setGauge('process_memory_heap_used_bytes', mem.heapUsed);
    store.setGauge('process_memory_heap_total_bytes', mem.heapTotal);
    store.setGauge('process_memory_external_bytes', mem.external);
    store.setGauge('process_uptime_seconds', process.uptime());

    const cpuUsage = process.cpuUsage();
    store.setGauge('process_cpu_user_microseconds', cpuUsage.user);
    store.setGauge('process_cpu_system_microseconds', cpuUsage.system);
  }

  static getWorkerStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [id, worker] of this.workers.entries()) {
      stats[id] = {
        ...worker,
        uptime: Date.now() - worker.startedAt,
        memoryUsage: {
          rss: Math.round(worker.memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(worker.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(worker.memoryUsage.heapTotal / 1024 / 1024)
        }
      };
    }
    return stats;
  }
}

// ── Health Check with Metrics ───────────────────────────────
export async function metricsHealthCheck(): Promise<Record<string, any>> {
  const health: Record<string, any> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    metrics: {
      totalHttpRequests: store.getSnapshot()['http_requests_total']?.count || 0,
      totalErrors: store.getSnapshot()['http_errors_total']?.count || 0,
      dbQueries: DatabaseMetricsCollector.getStats(),
      workers: WorkerMetricsCollector.getWorkerStats()
    }
  };

  try {
    const client = redisClient.getClient();
    await client.ping();
    health.redis = 'healthy';
  } catch {
    health.redis = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    const pool = getPool();
    const start = Date.now();
    await pool.query('SELECT 1');
    health.database = 'healthy';
    health.databaseLatency = `${Date.now() - start}ms`;
  } catch {
    health.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  return health;
}

// ── Prometheus Endpoint ─────────────────────────────────────
export function prometheusEndpoint(req: Request, res: Response): void {
  const output = store.toPrometheus();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(output);
}

// ── Metrics Snapshot Endpoint ───────────────────────────────
export function metricsSnapshotEndpoint(req: Request, res: Response): void {
  const snapshot = store.getSnapshot();
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      metrics: snapshot,
      database: DatabaseMetricsCollector.getStats(),
      workers: WorkerMetricsCollector.getWorkerStats()
    }
  });
}

// ── Start Periodic Collection ────────────────────────────────
const queueCollector = new QueueMetricsCollector();
let collectionInterval: ReturnType<typeof setInterval> | null = null;

export function startMetricsCollection(intervalMs: number = 30000): void {
  queueCollector.start(intervalMs);
  WorkerMetricsCollector.collectProcessMetrics();
  collectionInterval = setInterval(() => {
    WorkerMetricsCollector.collectProcessMetrics();
    DatabaseMetricsCollector.recordPoolStats(
      (getPool() as any)?.totalCount || 0,
      (getPool() as any)?.idleCount || 0,
      (getPool() as any)?.waitingCount || 0
    );
  }, intervalMs);
  logger.info('Metrics collection started', { intervalMs });
}

export function stopMetricsCollection(): void {
  queueCollector.stop();
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
  }
  logger.info('Metrics collection stopped');
}

export { store as metricStore };
