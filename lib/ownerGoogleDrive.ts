import { supabaseAdmin } from '@/lib/supabaseClient';
import { encryptSecret, decryptSecret } from '@/lib/tokenEncryption';

export async function saveOwnerDriveRefreshToken(
  ownerEmail: string,
  refreshToken: string,
): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  const encrypted = encryptSecret(refreshToken);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('owner_google_drive').upsert(
    {
      owner_email: email,
      refresh_token_encrypted: encrypted,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'owner_email' },
  );

  if (error) throw error;
}

export async function getOwnerDriveAccessToken(
  ownerEmail: string,
): Promise<string | null> {
  const email = ownerEmail.toLowerCase().trim();
  const { data: row, error } = await supabaseAdmin
    .from('owner_google_drive')
    .select('refresh_token_encrypted, connected_at')
    .eq('owner_email', email)
    .maybeSingle();

  if (error) throw error;
  if (!row?.refresh_token_encrypted || !row.connected_at) return null;

  const refreshToken = decryptSecret(row.refresh_token_encrypted);
  const { refreshGoogleAccessToken } = await import('@/lib/profissionalGoogleCalendar');
  const { accessToken } = await refreshGoogleAccessToken(refreshToken);
  return accessToken;
}

export async function hasOwnerDriveConnection(ownerEmail: string): Promise<boolean> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('owner_google_drive')
    .select('connected_at')
    .eq('owner_email', email)
    .maybeSingle();

  if (error) throw error;
  return !!data?.connected_at;
}
