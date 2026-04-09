import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_CALLBACK_URL: z.string().url('GITHUB_CALLBACK_URL must be a valid URL'),
  REPOS_ROOT: z.string().default('./runtime/repos'),
  ACT_BINARY: z.string().default('act'),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(2500),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).default(24),
  ENV_ENCRYPTION_KEY: z.string().min(32, 'ENV_ENCRYPTION_KEY must be at least 32 chars'),
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
