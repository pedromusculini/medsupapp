import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ authenticated: false, onboardingCompleted: false });
    }

    const access = await getGoogleAccessForSession(session);
    if (!access?.accessVerified) {
      return googleAccessDeniedResponse();
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('onboarding_profiles')
      .select('onboarding_completed')
      .eq('email', session.user.email.toLowerCase().trim())
      .single();

    if (error || !data) {
      return NextResponse.json({
        authenticated: true,
        onboardingCompleted: false,
        email: session.user.email,
      });
    }

    return NextResponse.json({
      authenticated: true,
      onboardingCompleted: data.onboarding_completed === true,
      email: session.user.email,
    });
  } catch (error) {
    console.error('[onboarding/status] Erro:', error);
    return NextResponse.json({ authenticated: false, onboardingCompleted: false });
  }
}
