import { Client } from 'minio';
import { logger } from '../core/logger';

export class MinioClient {
  private client: Client;
  private initialized = false;

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
    });
  }

  async initialize(): Promise<void> {
    try {
      const buckets = [
        process.env.MINIO_BUCKET_LEADS || 'leads',
        process.env.MINIO_BUCKET_SCREENSHOTS || 'screenshots',
        process.env.MINIO_BUCKET_LOGOS || 'logos',
        process.env.MINIO_BUCKET_FILES || 'files'
      ];

      for (const bucket of buckets) {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket, 'us-east-1');
          logger.info(`Created MinIO bucket: ${bucket}`);
        }
      }

      this.initialized = true;
      logger.info('MinIO initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MinIO:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getClient(): Client {
    return this.client;
  }

  async uploadFile(bucket: string, objectName: string, filePath: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('MinIO not initialized');
    }
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
    }
    await this.client.fPutObject(bucket, objectName, filePath);
    return `${bucket}/${objectName}`;
  }

  async uploadBuffer(bucket: string, objectName: string, buffer: Buffer): Promise<string> {
    if (!this.initialized) {
      throw new Error('MinIO not initialized');
    }
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
    }
    await this.client.putObject(bucket, objectName, buffer);
    return `${bucket}/${objectName}`;
  }

  async getFile(bucket: string, objectName: string): Promise<Buffer> {
    if (!this.initialized) {
      throw new Error('MinIO not initialized');
    }
    const stream = await this.client.getObject(bucket, objectName);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async removeFile(bucket: string, objectName: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('MinIO not initialized');
    }
    await this.client.removeObject(bucket, objectName);
  }
}

export const minioClient = new MinioClient();
