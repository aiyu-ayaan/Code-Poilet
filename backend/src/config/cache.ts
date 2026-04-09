import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

type CacheRecord = {
  value: string;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheRecord>();
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const client = createClient({ url: env.REDIS_URL });
  client.on('error', (error) => {
    logger.warn({ err: error }, 'Redis client error, falling back to memory cache');
  });

  await client.connect();
  redisClient = client;
  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return JSON.parse(entry.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 120) {
  const serialized = JSON.stringify(value);
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(key, serialized, { EX: ttlSeconds });
    return;
  }

  memoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDelete(key: string) {
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(key);
    return;
  }

  memoryCache.delete(key);
}
