import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizeBrazilPhone } from '@/lib/whatsapp';

export type WhatsAppConversaEstado =
  | 'aguardando_confirmacao'
  | 'confirmado'
  | 'cancelado';

export async function upsertWhatsAppConversa(params: {
  ownerEmail: string;
  telefone: string;
  consultaId: string;
  estado?: WhatsAppConversaEstado;
}): Promise<void> {
  const telefone = normalizeBrazilPhone(params.telefone);
  const { error } = await supabaseAdmin.from('whatsapp_conversa').upsert(
    {
      owner_email: params.ownerEmail.toLowerCase().trim(),
      telefone,
      consulta_id: params.consultaId,
      estado: params.estado ?? 'aguardando_confirmacao',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_email,telefone' },
  );

  if (error && error.code !== 'PGRST205') throw error;
}

export async function findConversaByTelefone(
  telefone: string,
): Promise<{
  owner_email: string;
  consulta_id: string | null;
  estado: string;
} | null> {
  const digits = normalizeBrazilPhone(telefone);
  const { data, error } = await supabaseAdmin
    .from('whatsapp_conversa')
    .select('owner_email, consulta_id, estado')
    .eq('telefone', digits)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return null;
    throw error;
  }
  return data;
}

export async function updateConversaEstado(
  ownerEmail: string,
  telefone: string,
  estado: WhatsAppConversaEstado,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('whatsapp_conversa')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('telefone', normalizeBrazilPhone(telefone));

  if (error && error.code !== 'PGRST205') throw error;
}

/** IDs dos botões interativos Meta (máx. 256 caracteres) */
export function buildConfirmButtonId(acao: 'confirmar' | 'cancelar', consultaId: string): string {
  const safeId = consultaId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  return `${acao}_${safeId}`;
}

export function parseConfirmButtonId(
  buttonId: string,
): { acao: 'confirmar' | 'cancelar'; consultaId: string } | null {
  if (buttonId.startsWith('confirmar_')) {
    return { acao: 'confirmar', consultaId: buttonId.slice('confirmar_'.length) };
  }
  if (buttonId.startsWith('cancelar_')) {
    return { acao: 'cancelar', consultaId: buttonId.slice('cancelar_'.length) };
  }
  return null;
}
