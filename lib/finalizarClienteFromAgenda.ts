import type { FormaPagamentoConsulta } from '@/lib/consultations';

export type FinalizarClienteAgendaBody = {
  data: string;
  hora: string | null;
  valor: number;
  valorOriginal: number;
  descontoPercent: number;
  descontoValor: number;
  forma_pagamento: FormaPagamentoConsulta;
  medico: string;
  parcelas: number;
  tipo: 'consulta' | 'retorno';
  plano?: string | null;
  observacoes: string | null;
};

export type FinalizarClienteAgendaResult =
  | { ok: true }
  | { ok: false; error: string };

/** POST /api/clientes/:id/finalizar com tratamento de erro HTTP. */
export async function postFinalizarClienteFromAgenda(
  clienteDriveId: string,
  body: FinalizarClienteAgendaBody,
): Promise<FinalizarClienteAgendaResult> {
  try {
    const res = await fetch(`/api/clientes/${clienteDriveId}/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: body.data,
        hora: body.hora,
        valor: body.valorOriginal,
        valorOriginal: body.valorOriginal,
        descontoPercent: body.descontoPercent,
        descontoValor: body.descontoValor,
        forma_pagamento: body.forma_pagamento,
        medico: body.medico,
        parcelas: body.parcelas,
        tipo: body.tipo,
        plano: body.plano ?? null,
        observacoes: body.observacoes,
      }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: data.error?.trim() || `Erro ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede',
    };
  }
}

export const MSG_FINALIZAR_CLIENTE_FALHOU =
  'Consulta finalizada na agenda, mas não foi possível registrar na ficha do paciente. Abra a ficha do paciente para sincronizar ou lance o atendimento manualmente.';
