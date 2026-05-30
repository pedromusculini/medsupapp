import { updateConsultaAgendaStatus } from '@/lib/consultasAgenda';
import {
  findConversaByTelefone,
  parseConfirmButtonId,
  updateConversaEstado,
} from '@/lib/whatsappConversa';
import { sendTextMessage } from '@/lib/whatsappCloud';
import type { ConsultaStatus } from '@/lib/consultations';

type InboundMessage = {
  from: string;
  type: string;
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
  };
  text?: { body?: string };
};

export async function handleInboundWhatsAppMessage(
  message: InboundMessage,
): Promise<void> {
  const from = message.from?.replace(/\D/g, '') ?? '';
  if (!from) return;

  let buttonId: string | null = null;
  if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
    buttonId = message.interactive.button_reply?.id ?? null;
  }

  if (!buttonId) return;

  const parsed = parseConfirmButtonId(buttonId);
  if (!parsed) return;

  const conversa = await findConversaByTelefone(from);
  if (!conversa?.owner_email) return;

  const consultaId = parsed.consultaId || conversa.consulta_id;
  if (!consultaId) return;

  const novoStatus: ConsultaStatus =
    parsed.acao === 'confirmar' ? 'confirmado' : 'cancelado';

  await updateConsultaAgendaStatus(consultaId, conversa.owner_email, novoStatus);
  await updateConversaEstado(
    conversa.owner_email,
    from,
    parsed.acao === 'confirmar' ? 'confirmado' : 'cancelado',
  );

  const texto =
    parsed.acao === 'confirmar'
      ? 'Presença confirmada. Obrigado!'
      : 'Consulta cancelada conforme sua resposta. Entre em contato com a clínica se precisar remarcar.';

  await sendTextMessage(from, texto);
}
