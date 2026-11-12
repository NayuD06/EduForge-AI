import { z } from 'zod';

/** Chuỗi rỗng trong .env (ví dụ `ANTHROPIC_API_KEY=`) được coi như không khai báo. */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:8081'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET phải dài ít nhất 16 ký tự'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('eduforge'),
  S3_ACCESS_KEY: z.string().default('eduforge'),
  S3_SECRET_KEY: z.string().default('eduforge123'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  ANTHROPIC_API_KEY: optionalString,
  CLAUDE_MODEL: z.string().default('claude-opus-5-5'),
  VOYAGE_API_KEY: optionalString,
  EMBEDDING_MODEL: z.string().default('voyage-3.5'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ (xem apps/api/.env.example):\n${issues}`);
  }
  return parsed.data;
}
