import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  createClienteRecord,
  finalizarAtendimentoNoCliente,
  findCliente,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';

const FORMAS_VALIDAS = new Set(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();

  if (!body.data) {
    return NextResponse.json({ error: 'Data do atendimento é obrigatória' }, { status: 400 });
  }
  if (!body.hora) {
    return NextResponse.json({ error: 'Hora do atendimento é obrigatória' }, { status: 400 });
  }
  if (!body.plano || !String(body.plano).trim()) {
    return NextResponse.json({ error: 'Plano / convênio é obrigatório' }, { status: 400 });
  }
  if (!body.forma_pagamento || !FORMAS_VALIDAS.has(body.forma_pagamento)) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const valorOriginal = Number(body.valorOriginal ?? body.valor ?? 0);
  if (body.forma_pagamento !== 'permuta' && valorOriginal <= 0) {
    return NextResponse.json({ error: 'Informe o valor do atendimento' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);

  let cliente;
  if (body.cliente_id) {
    cliente = findCliente(store, String(body.cliente_id));
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }
  } else {
    const nome = String(body.nome ?? '').trim();
    if (nome.length < 2) {
      return NextResponse.json(
        { error: 'Informe o nome do paciente (mín. 2 caracteres) ou selecione um cliente' },
        { status: 400 },
      );
    }
    cliente = createClienteRecord({
      nome,
      convenio: body.plano || null,
      observacoes_gerais: '[Cadastro automático — atendimento avulso]',
    });
    store.clientes.push(cliente);
  }

  const { atendimento, pagamento, tipo } = finalizarAtendimentoNoCliente(cliente, {
    data: body.data,
    hora: body.hora || null,
    valor: valorOriginal,
    valorOriginal,
    descontoPercent: Number(body.descontoPercent) || 0,
    descontoValor: Number(body.descontoValor) || 0,
    forma_pagamento: body.forma_pagamento,
    plano: body.plano || null,
    medico: body.medico || null,
    parcelas: Math.max(1, Number(body.parcelas) || 1),
    tipo: body.tipo || null,
    observacoes: body.observacoes || null,
  });

  await saveClientesStore(tokenResult, store);

  try {
    const formaLabel =
      FORMAS_PAGAMENTO_ATENDIMENTO.find((f) => f.id === body.forma_pagamento)?.label ??
      body.forma_pagamento;
    await fetch(new URL('/api/financeiro', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        tipo: 'entrada',
        descricao: `${tipo === 'retorno' ? 'Retorno' : 'Consulta'} — ${cliente.nome}`,
        data: body.data,
        valor: pagamento.valor,
        categoria: 'consulta',
        medico: body.medico || null,
        observacao: `${formaLabel}${body.plano ? ` · ${body.plano}` : ''}`,
      }),
    });
  } catch {
    /* financeiro opcional */
  }

  const { atendimentos, observacoes, pagamentos, ...clienteResumo } = cliente;

  return NextResponse.json(
    {
      cliente: clienteResumo,
      atendimento,
      pagamento,
      tipo,
      criadoSemCadastro: !body.cliente_id,
      message:
        tipo === 'retorno'
          ? 'Atendimento finalizado como RETORNO (última consulta há menos de 30 dias)'
          : 'Atendimento finalizado com sucesso',
    },
    { status: 201 },
  );
}
