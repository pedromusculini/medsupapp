import { NextResponse } from 'next/server';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { getGoogleOAuthRedirectUris } from '@/lib/appUrl';
import {
  getAuthSecretVersion,
  isAuthSigningSecretConfigured,
} from '@/lib/authSigningSecret';
import { isProntuarioTokenEnabled } from '@/lib/prontuarioTokenFeature';
import { RATE_LIMITS_SETUP_HINT } from '@/lib/rateLimitStore';
import { VERIFICATION_CODES_SETUP_HINT } from '@/lib/googleVerificationCodes';

/** Auth env check (outside /api/auth to avoid NextAuth catch-all). */
export async function GET() {
  const has = (key: string) => Boolean(process.env[key]?.trim());
  const signingConfigured = isAuthSigningSecretConfigured();
  const sessionSecret = has('AUTH_SECRET') || has('NEXTAUTH_SECRET');

  return NextResponse.json({
    ok:
      signingConfigured &&
      sessionSecret &&
      has('GOOGLE_CLIENT_ID') &&
      has('GOOGLE_CLIENT_SECRET'),
    checks: {
      AUTH_SECRET: has('AUTH_SECRET'),
      NEXTAUTH_SECRET: has('NEXTAUTH_SECRET'),
      JWT_SECRET: has('JWT_SECRET'),
      jwtSigningSecret: signingConfigured,
      authSecretVersion: getAuthSecretVersion(),
      signingSecretSource: signingConfigured
        ? process.env.JWT_SECRET?.trim()
          ? 'JWT_SECRET'
          : process.env.AUTH_SECRET?.trim()
            ? 'AUTH_SECRET'
            : 'NEXTAUTH_SECRET'
        : null,
      AUTH_URL: has('AUTH_URL'),
      NEXTAUTH_URL: has('NEXTAUTH_URL'),
      GOOGLE_CLIENT_ID: has('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: has('GOOGLE_CLIENT_SECRET'),
      NEXT_PUBLIC_SUPABASE_URL: has('NEXT_PUBLIC_SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
      RESEND_API_KEY: has('RESEND_API_KEY'),
      RESEND_FROM: has('RESEND_FROM'),
      ASAAS_WEBHOOK_TOKEN: has('ASAAS_WEBHOOK_TOKEN'),
      ASAAS_API_KEY: has('ASAAS_API_KEY'),
      ASAAS_API_URL: has('ASAAS_API_URL'),
      ASAAS_BILLING_ENFORCED: process.env.ASAAS_BILLING_ENFORCED ?? '(not set)',
      PRONTUARIO_TOKEN_ENABLED: isProntuarioTokenEnabled(),
      rateLimitsHint: RATE_LIMITS_SETUP_HINT,
      verificationCodesHint: VERIFICATION_CODES_SETUP_HINT,
    },
    canonicalUrl: CANONICAL_APP_URL,
    googleRedirectUris: getGoogleOAuthRedirectUris(CANONICAL_APP_URL),
    hint: `Set AUTH_URL=${CANONICAL_APP_URL}. Register both googleRedirectUris in Google Cloud Console. Rotate AUTH_SECRET then bump AUTH_SECRET_VERSION to invalidate prontuario_unlock cookies.`,
  });
}
