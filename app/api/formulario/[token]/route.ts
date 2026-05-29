import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { buildWhatsAppQueuePayload } from '@/lib/whatsapp';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: link, error } = await supabaseAdmin
    .from('formulario_links')
    .select('titulo, ativo, expires_at, cliente_drive_id')
    .eq('token', token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 404 });
  }

  if (!link.ativo) {
    return NextResponse.json({ error: 'Este formulário não está mais ativo' }, { status: 410 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
  }

  const autocadastro = !link.cliente_drive_id;

  return NextResponse.json({
    titulo: link.titulo,
    autocadastro,
    descricao: autocadastro
      ? 'Preencha seus dados para se cadastrar na clínica.'
      : 'Confirme ou atualize seus dados.',
    campos: ['nome', 'email', 'telefone', 'cpf', 'data_nascimento', 'convenio', 'motivo_consulta', 'observacoes'],
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: link, error: linkError } = await supabaseAdmin
    .from('formulario_links')
    .select('*')
    .eq('token', token)
    .single();

  if (linkError || !link || !link.ativo) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
  }

  const dados = await req.json();
  const nome = String(dados.nome ?? '').trim();
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome completo' }, { status: 400 });
  }

  const { data: resposta, error } = await supabaseAdmin
    .from('formulario_respostas')
    .insert({
      link_id: link.id,
      token,
      dados,
      origem: dados.origem === 'whatsapp' ? 'whatsapp' : 'web',
      sincronizado_drive: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (dados.telefone) {
    await supabaseAdmin.from('whatsapp_fila').insert({
      owner_email: link.owner_email,
      telefone: String(dados.telefone).replace(/\D/g, ''),
      tipo: 'formulario_recebido',
      payload: buildWhatsAppQueuePayload('formulario_recebido', {
        resposta_id: resposta.id,
        token,
        paciente: nome,
        nomeClinica: link.titulo || 'Clínica',
      }),
      status: 'pendente',
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Dados enviados com sucesso. Obrigado!',
  });
}
