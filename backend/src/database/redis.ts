import { createClient, RedisClientType } from 'redis';
import { logger } from '../core/logger';

export class RedisClient {
  private client: RedisClientType;
  private subscriber: RedisClientType | null = null;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }) as RedisClientType;

    if (process.env.REDIS_PASSWORD) {
      (this.client as any).options.password = process.env.REDIS_PASSWORD;
    }
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async quit(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  createSubscriber(): RedisClientType {
    if (!this.subscriber) {
      this.subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      }) as RedisClientType;
      if (process.env.REDIS_PASSWORD) {
        (this.subscriber as any).options.password = process.env.REDIS_PASSWORD;
      }
    }
    return this.subscriber;
  }
}

export const redisClient = new RedisClient();
