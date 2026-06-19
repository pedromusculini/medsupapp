/**
 * Rate limit com store compartilhado no Supabase (`rate_limits` + RPC `check_rate_limit`).
 * Fallback em memória só se a migração ainda não foi aplicada (dev/local).
 */
import {
  checkRateLimitInStore,
  resetRateLimitInStore,
  type RateLimitResult,
} from '@/lib/rateLimitStore';

export type { RateLimitResult };

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

function pruneMemory(key: string, bucket: Bucket, now: number): Bucket | null {
  if (now >= bucket.resetAt) {
    memoryBuckets.delete(key);
    return null;
  }
  return bucket;
}

function checkRateLimitMemory(
  key: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  const bucket = existing ? pruneMemory(key, existing, now) : null;

  if (!bucket) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true };
}

function resetRateLimitMemory(key: string) {
  memoryBuckets.delete(key);
}

/** Compatível com callers anteriores; agora assíncrono (Supabase). */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const fromStore = await checkRateLimitInStore(key, maxAttempts, windowMs);
  if (fromStore !== null) return fromStore;

  if (process.env.NODE_ENV === 'production') {
    console.warn('[rateLimit] store indisponível — usando fallback in-memory para', key.slice(0, 48));
  }
  return checkRateLimitMemory(key, maxAttempts, windowMs);
}

export async function resetRateLimit(key: string): Promise<void> {
  const ok = await resetRateLimitInStore(key);
  if (!ok) resetRateLimitMemory(key);
  else memoryBuckets.delete(key);
}
