import { logger } from './logger';

export interface AppError extends Error {
  status?: number;
  errors?: any[];
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: any[] = [],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function errorHandler(err: AppError, req: any, res: any, _next: any): void {
  const statusCode = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error('Error occurred:', {
    error: err.message,
    stack: isProduction ? undefined : err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
    });
    return;
  }

  if (err.name === 'NotFoundError') {
    res.status(404).json({
      success: false,
      message: err.message,
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
