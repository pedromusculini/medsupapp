import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  isConsultasAgendaTableMissing,
  repairConsultasAgendaForOwner,
} from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

/** Deduplica consultas_agenda e promove ids local-/google- para UUID. */
export async function POST() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const result = await repairConsultasAgendaForOwner(email);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json(
        { error: 'Execute sql/consultas_whatsapp_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : typeof e.message === 'string'
          ? e.message
          : 'Erro ao reparar agenda';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
