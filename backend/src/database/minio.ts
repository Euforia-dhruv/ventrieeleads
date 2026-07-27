import Minio from 'minio';
import { logger } from '../core/logger';
import { DatabaseError } from '../core/errorHandler';

export class MinioClient {
  private client: Minio.Client;
  private initialized = false;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
    });
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(process.env.MINIO_BUCKET_LEADS || 'leads');
      if (!exists) {
        await this.client.makeBucket(process.env.MINIO_BUCKET_LEADS || 'leads');
        await this.client.bucketQos(process.env.MINIO_BUCKET_LEADS || 'leads', {
          'Location': 'us-east-1'
        });
      }

      const screenshotsBucket = process.env.MINIO_BUCKET_SCREENSHOTS || 'screenshots';
      const existsScreenshots = await this.client.bucketExists(screenshotsBucket);
      if (!existsScreenshots) {
        await this.client.makeBucket(screenshotsBucket);
      }

      const logosBucket = process.env.MINIO_BUCKET_LOGOS || 'logos';
      const existsLogos = await this.client.bucketExists(logosBucket);
      if (!existsLogos) {
        await this.client.makeBucket(logosBucket);
      }

      this.initialized = true;
      logger.info('MinIO initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MinIO:', error);
      throw new DatabaseError('MinIO initialization failed');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getClient(): Minio.Client {
    if (!this.initialized) {
      throw new DatabaseError('MinIO not initialized');
    }
    return this.client;
  }

  async uploadFile(bucket: string, objectName: string, filePath: string): Promise<string> {
    if (!this.initialized) {
      throw new DatabaseError('MinIO not initialized');
    }
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
    await this.client.fPutObject(bucket, objectName, filePath);
    return `${bucket}/${objectName}`;
  }

  async uploadBuffer(bucket: string, objectName: string, buffer: Buffer): Promise<string> {
    if (!this.initialized) {
      throw new DatabaseError('MinIO not initialized');
    }
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
    await this.client.putObject(bucket, objectName, buffer);
    return `${bucket}/${objectName}`;
  }

  async getFile(bucket: string, objectName: string): Promise<Buffer> {
    if (!this.initialized) {
      throw new DatabaseError('MinIO not initialized');
    }
    return await this.client.getObject(bucket, objectName);
  }

  async removeFile(bucket: string, objectName: string): Promise<void> {
    if (!this.initialized) {
      throw new DatabaseError('MinIO not initialized');
    }
    await this.client.removeObject(bucket, objectName);
  }
}

export const minioClient = new MinioClient();
