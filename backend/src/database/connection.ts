import { Pool } from 'pg';
import { logger } from '../core/logger';
import { DatabaseError } from '../core/errorHandler';

let pool: Pool | null = null;

export interface DatabaseConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
  ssl?: boolean;
}

export async function connectToDatabase(): Promise<void> {
  try {
    const config: DatabaseConfig = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'leads',
      password: process.env.DB_PASSWORD || 'password',
      port: parseInt(process.env.DB_PORT || '5432'),
      ssl: process.env.DB_SSL === 'true'
    };

    const connectionString = 
      `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

    if (process.env.DATABASE_URL) {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      pool = new Pool(config);
    }

    pool.on('error', (err: Error) => {
      logger.error('Database connection error:', err);
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    logger.info('Connected to PostgreSQL database');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw new DatabaseError('Database connection failed');
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new DatabaseError('Database not connected');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}
