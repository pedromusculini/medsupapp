import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { getGoogleAccessToken } from '@/lib/driveAuth';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import { syncPendingProntuarioForOwner } from '@/lib/syncProntuarioDrive';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const cookieToken = await getGoogleAccessToken(req);
  const storedToken = await getOwnerDriveAccessToken(email);
  const accessToken = cookieToken ?? storedToken;

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          'Conecte o Google Drive para sincronizar prontuários. Vá em Backup ou autorize o Drive.',
        code: 'DRIVE_NOT_CONNECTED',
      },
      { status: 403 },
    );
  }

  const count = await syncPendingProntuarioForOwner(email, accessToken);
  return NextResponse.json({ sincronizados: count });
}
