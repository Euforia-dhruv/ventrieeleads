import Redis from 'redis';
import { logger } from '../core/logger';

export class RedisClient {
  private client: Redis.RedisClientType;
  private subscriber: Redis.RedisClientType | null = null;

  constructor() {
    this.client = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    if (process.env.REDIS_PASSWORD) {
      this.client.options.password = process.env.REDIS_PASSWORD;
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

  getClient(): Redis.RedisClientType {
    return this.client;
  }

  createSubscriber(): Redis.RedisClientType {
    if (!this.subscriber) {
      this.subscriber = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      if (process.env.REDIS_PASSWORD) {
        this.subscriber.options.password = process.env.REDIS_PASSWORD;
      }
    }
    return this.subscriber;
  }
}

export const redisClient = new RedisClient();
