import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Também tentar pegar de cookie
    const cookieToken = request.cookies.get('session_token')?.value;
    
    const finalToken = token || cookieToken;
    
    if (!finalToken) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifyToken(finalToken);
    
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      },
    });
  } catch (error) {
    console.error('[session] Error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}