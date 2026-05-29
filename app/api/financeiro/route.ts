import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getGoogleAccessToken } from '@/lib/driveAuth';
import { loadFaturamentoStore, saveFaturamentoStore } from '@/lib/clientesDrive';

// GET /api/financeiro?start=YYYY-MM-DD&end=YYYY-MM-DD&type=entrada|saida&medicos=med1,med2
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const type = searchParams.get('type');
    const medicos = searchParams.get('medicos'); // comma-separated

    let query = supabaseAdmin
      .from('financeiro_transacoes')
      .select('*')
      .order('data', { ascending: false });

    if (start) {
      query = query.gte('data', start);
    }
    if (end) {
      query = query.lte('data', end);
    }
    if (type && (type === 'entrada' || type === 'saida')) {
      query = query.eq('tipo', type);
    }
    if (medicos) {
      const medicoList = medicos.split(',').map(m => m.trim()).filter(Boolean);
      if (medicoList.length > 0) {
        query = query.in('medico', medicoList);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[financeiro/GET] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buscar splits para as entradas
    const entradasIds = (data || [])
      .filter((t: any) => t.tipo === 'entrada')
      .map((t: any) => t.id);

    let splitsMap: Record<string, any[]> = {};
    if (entradasIds.length > 0) {
      const { data: splitsData } = await supabaseAdmin
        .from('financeiro_splits')
        .select('*')
        .in('transacao_id', entradasIds);

      for (const split of splitsData || []) {
        if (!splitsMap[split.transacao_id]) {
          splitsMap[split.transacao_id] = [];
        }
        splitsMap[split.transacao_id].push(split);
      }
    }

    const hydrated = (data || []).map((t: any) => ({
      ...t,
      splits: splitsMap[t.id] || [],
    }));

    return NextResponse.json(hydrated);
  } catch (error: any) {
    console.error('[financeiro/GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/financeiro - Criar transação
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tipo,           // 'entrada' ou 'saida'
      descricao,      // ex: 'Consulta Dr. João'
      data,           // 'YYYY-MM-DD'
      valor,          // número
      categoria,      // ex: 'consulta', 'procedimento', 'despesa_fixa', 'despesa_variavel'
      medico,         // nome do médico (opcional, para entradas)
      splits,         // array de { medico: string, porcentagem: number } para split
      observacao,     // opcional
    } = body;

    if (!tipo || !descricao || !data || valor === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipo, descricao, data, valor' },
        { status: 400 },
      );
    }

    if (!['entrada', 'saida'].includes(tipo)) {
      return NextResponse.json(
        { error: 'tipo deve ser "entrada" ou "saida"' },
        { status: 400 },
      );
    }

    // Inserir transação
    const { data: transacao, error } = await supabaseAdmin
      .from('financeiro_transacoes')
      .insert({
        tipo,
        descricao,
        data,
        valor: Number(valor),
        categoria: categoria || null,
        medico: medico || null,
        observacao: observacao || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[financeiro/POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Inserir splits se for entrada e tiver splits definidos
    let insertedSplits: any[] = [];
    if (tipo === 'entrada' && splits && splits.length > 0) {
      const splitsToInsert = splits.map((s: any) => ({
        transacao_id: transacao.id,
        medico: s.medico,
        porcentagem: Number(s.porcentagem),
        valor_split: (Number(valor) * Number(s.porcentagem)) / 100,
      }));

      const { data: splitsResult, error: splitsError } = await supabaseAdmin
        .from('financeiro_splits')
        .insert(splitsToInsert)
        .select();

      if (splitsError) {
        console.error('[financeiro/POST] Splits error:', splitsError);
      } else {
        insertedSplits = splitsResult || [];
      }
    }

    const responseBody = { ...transacao, splits: insertedSplits };

    const session = await auth();
    const driveToken = await getGoogleAccessToken(req);
    if (driveToken && session?.user?.email) {
      try {
        const store = await loadFaturamentoStore(
          driveToken,
          session.user.email.toLowerCase().trim(),
        );
        store.transacoes.unshift(responseBody);
        await saveFaturamentoStore(driveToken, store);
      } catch (driveErr) {
        console.warn('[financeiro/POST] Espelho Drive:', driveErr);
      }
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error: any) {
    console.error('[financeiro/POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE /api/financeiro?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Deletar splits primeiro
    await supabaseAdmin
      .from('financeiro_splits')
      .delete()
      .eq('transacao_id', id);

    // Deletar transação
    const { error } = await supabaseAdmin
      .from('financeiro_transacoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[financeiro/DELETE] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[financeiro/DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}