import {
  appendProntuarioHintToProfessionalDescription,
  stripProntuarioHintFromDescription,
} from '@/lib/calendarInvite';
import { ensureClienteFormularioLink } from '@/lib/formularioLinks';
import { buildClienteFichaProfissionalUrl } from '@/lib/publicFormLinks';
import { createShortRedirectUrl } from '@/lib/shortLink';

export type ProfessionalCalendarEnrichment = {
  description: string;
  location?: string;
  fichaUrl?: string;
};

/** Descrição + location do evento na agenda do médico (ficha clicável via campo location no iOS). */
export async function enrichProfessionalCalendarEvent(params: {
  description: string;
  location?: string | null;
  ownerEmail: string;
  clienteDriveId?: string | null;
  nomeCliente?: string | null;
  baseUrl?: string;
}): Promise<ProfessionalCalendarEnrichment> {
  const baseDescription = stripProntuarioHintFromDescription(params.description || '');

  const clienteDriveId = params.clienteDriveId?.trim();
  if (!clienteDriveId) {
    return { description: baseDescription, location: params.location ?? undefined };
  }

  try {
    const { token } = await ensureClienteFormularioLink({
      ownerEmail: params.ownerEmail,
      clienteDriveId,
      nomeCliente: params.nomeCliente?.trim() || undefined,
    });
    const fichaUrl = buildClienteFichaProfissionalUrl(token, params.baseUrl);
    const shortUrl = createShortRedirectUrl(fichaUrl) || fichaUrl;
    return {
      description: appendProntuarioHintToProfessionalDescription(baseDescription),
      location: shortUrl,
      fichaUrl: shortUrl,
    };
  } catch (err) {
    console.warn('[professionalCalendarProntuario]', err);
    return { description: baseDescription, location: params.location ?? undefined };
  }
}
