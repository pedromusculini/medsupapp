import { NextResponse } from 'next/server';
import { CANONICAL_APP_URL } from '@/lib/constants';

/** Auth env check (outside /api/auth to avoid NextAuth catch-all). */
export async function GET() {
  const has = (key: string) => Boolean(process.env[key]?.trim());

  return NextResponse.json({
    ok:
      (has('AUTH_SECRET') || has('NEXTAUTH_SECRET')) &&
      has('GOOGLE_CLIENT_ID') &&
      has('GOOGLE_CLIENT_SECRET'),
    checks: {
      AUTH_SECRET: has('AUTH_SECRET'),
      NEXTAUTH_SECRET: has('NEXTAUTH_SECRET'),
      AUTH_URL: has('AUTH_URL'),
      NEXTAUTH_URL: has('NEXTAUTH_URL'),
      GOOGLE_CLIENT_ID: has('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: has('GOOGLE_CLIENT_SECRET'),
      NEXT_PUBLIC_SUPABASE_URL: has('NEXT_PUBLIC_SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
      ASAAS_WEBHOOK_TOKEN: has('ASAAS_WEBHOOK_TOKEN'),
      ASAAS_API_KEY: has('ASAAS_API_KEY'),
      ASAAS_BILLING_ENFORCED: process.env.ASAAS_BILLING_ENFORCED ?? '(not set)',
    },
    canonicalUrl: CANONICAL_APP_URL,
    hint: `Set AUTH_URL=${CANONICAL_APP_URL} and Google OAuth redirect to ${CANONICAL_APP_URL}/api/auth/callback/google`,
  });
}
