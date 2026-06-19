/**
 * Rate limit para `/api/prontuario/*` (IP + token) via Supabase compartilhado.
 */
import { checkRateLimit } from '@/lib/rateLimit';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 120;
const MAX_PER_TOKEN = 60;

export async function checkProntuarioTokenRateLimit(
  kind: 'ip' | 'token',
  value: string,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const key = `prontuario-${kind}:${value}`;
  const max = kind === 'ip' ? MAX_PER_IP : MAX_PER_TOKEN;
  return checkRateLimit(key, max, WINDOW_MS);
}
