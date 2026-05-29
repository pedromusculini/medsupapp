import { NextResponse } from 'next/server';

/** Safe production check: which auth env vars are set (no secret values). */
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
    },
    hint: 'In Vercel Production, set AUTH_SECRET (or NEXTAUTH_SECRET), GOOGLE_CLIENT_*, AUTH_URL=https://medsupapp.com.br',
  });
}
