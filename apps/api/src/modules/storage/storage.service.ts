import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Global, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

/**
 * Lưu file (PDF tài liệu khóa học).
 *  - STORAGE_DRIVER=local (mặc định): ghi vào thư mục apps/api/storage – không cần cài thêm gì khi dev.
 *  - STORAGE_DRIVER=s3: S3 thật (AWS, Cloudflare R2) hoặc server tương thích S3 (MinIO/RustFS trong docker-compose).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: Env['STORAGE_DRIVER'];
  private readonly localDir: string;
  private readonly bucket: string;
  private readonly s3: S3Client | null;

  constructor(config: ConfigService<Env, true>) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.localDir = resolve(config.get('STORAGE_LOCAL_DIR', { infer: true }));
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.s3 =
      this.driver === 's3'
        ? new S3Client({
            endpoint: config.get('S3_ENDPOINT', { infer: true }),
            region: config.get('S3_REGION', { infer: true }),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
            credentials: {
              accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
              secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
            },
          })
        : null;
  }

  async onModuleInit() {
    if (!this.s3) {
      await mkdir(this.localDir, { recursive: true });
      this.logger.log(`Lưu file cục bộ tại ${this.localDir}`);
      return;
    }
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Đã tạo bucket "${this.bucket}"`);
      } catch (error) {
        this.logger.warn(
          `Không truy cập được S3 (${(error as Error).message}). Upload tài liệu sẽ lỗi.`,
        );
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } else {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    }
    return key;
  }

  async getBuffer(key: string): Promise<Buffer> {
    if (!this.s3) return readFile(this.localPath(key));
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`File rỗng: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async ping(): Promise<boolean> {
    try {
      if (this.s3) await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      else await access(this.localDir);
      return true;
    } catch {
      return false;
    }
  }

  private localPath(key: string) {
    const path = resolve(join(this.localDir, key));
    if (!path.startsWith(this.localDir)) throw new Error('Đường dẫn file không hợp lệ');
    return path;
  }
}

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
