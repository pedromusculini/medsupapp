import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  isConsultasAgendaTableMissing,
  patchConsultaAgendaTime,
} from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** PATCH horário no Supabase (push Google fica no cliente). */
export async function PATCH(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  const inicio = toIsoOrNull(body.inicio ?? body.start);
  const fim = toIsoOrNull(body.fim ?? body.end);

  if (!id || !inicio) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: id, inicio' },
      { status: 400 },
    );
  }

  try {
    const row = await patchConsultaAgendaTime(email, id, inicio, fim);
    if (!row) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      consulta: {
        id: row.id,
        inicio: row.inicio,
        fim: row.fim,
        updated_at: row.updated_at,
      },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json(
        { error: 'Execute sql/consultas_whatsapp_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : 'Erro ao salvar horário';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
