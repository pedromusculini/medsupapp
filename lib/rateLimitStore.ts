import { supabaseAdmin } from '@/lib/supabaseClient';

export type RateLimitResult = { allowed: boolean; retryAfterSec?: number };

export const RATE_LIMITS_SETUP_HINT =
  'Execute no Supabase: npm run db:rate-limits (ou sql/rate_limits_schema.sql).';

const BUCKET_KEY_MAX = 255;

function normalizeBucketKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= BUCKET_KEY_MAX) return trimmed;
  return trimmed.slice(0, BUCKET_KEY_MAX);
}

function isRateLimitsDbError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    msg.includes('rate_limits') ||
    msg.includes('check_rate_limit') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export async function checkRateLimitInStore(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const bucketKey = normalizeBucketKey(key);
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_bucket_key: bucketKey,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (isRateLimitsDbError(error)) {
      console.warn('[rateLimitStore] tabela/RPC ausente:', error.message);
      return null;
    }
    console.error('[rateLimitStore] check_rate_limit:', error);
    return null;
  }

  const row = data as { allowed?: boolean; retry_after_sec?: number } | null;
  if (!row || typeof row.allowed !== 'boolean') {
    return { allowed: true };
  }

  return {
    allowed: row.allowed,
    ...(row.retry_after_sec != null
      ? { retryAfterSec: Math.max(1, Number(row.retry_after_sec)) }
      : {}),
  };
}

export async function resetRateLimitInStore(key: string): Promise<boolean> {
  const bucketKey = normalizeBucketKey(key);
  const { error } = await supabaseAdmin.rpc('reset_rate_limit', {
    p_bucket_key: bucketKey,
  });

  if (error) {
    if (isRateLimitsDbError(error)) return false;
    console.error('[rateLimitStore] reset_rate_limit:', error);
    return false;
  }

  return true;
}
