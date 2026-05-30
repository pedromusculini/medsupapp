import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import { fetchGoogleContacts } from '@/lib/googleContacts';
import { filterClientes, findClienteByContato, loadClientesStore } from '@/lib/clientesDrive';
import { phoneDigits } from '@/lib/phoneMatch';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import type { PacienteOpcao } from '@/lib/types';

function mapDrive(c: {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
}): PacienteOpcao {
  return {
    id: `d:${c.id}`,
    nome: c.nome,
    telefone: c.telefone ? aplicarMascaraWhatsapp(c.telefone) : null,
    email: c.email,
    cpf: c.cpf,
    data_nascimento: c.data_nascimento,
    convenio: c.convenio,
    origem: 'drive',
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) return driveToken;

  const store = await loadClientesStore(driveToken, email);
  const driveList = filterClientes(store, q || undefined);

  const opcoes: PacienteOpcao[] = driveList.map(mapDrive);

  const seenPhones = new Set(driveList.map((c) => phoneDigits(c.telefone)).filter(Boolean));

  const contactsToken = await requireGoogleContactsToken(req);
  const googleContatosDisponivel = !isContactsError(contactsToken);

  if (googleContatosDisponivel) {
    try {
      const imports = await fetchGoogleContacts(contactsToken);
      for (const contact of imports) {
        const tel = contact.telefone ? aplicarMascaraWhatsapp(contact.telefone) : null;
        const pd = phoneDigits(tel);
        if (pd && seenPhones.has(pd)) continue;

        const nome = contact.nome?.trim();
        if (!nome) continue;

        if (q) {
          const hay = `${nome} ${tel ?? ''} ${contact.email ?? ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }

        const existente = findClienteByContato(store, {
          telefone: contact.telefone,
          email: contact.email,
        });
        if (existente) {
          if (!opcoes.some((o) => o.id === `d:${existente.id}`)) {
            const merged = mapDrive(existente);
            if (!merged.telefone && tel) merged.telefone = tel;
            if (!merged.email && contact.email) merged.email = contact.email;
            if (!merged.data_nascimento && contact.data_nascimento) {
              merged.data_nascimento = contact.data_nascimento;
            }
            opcoes.push(merged);
          }
          if (pd) seenPhones.add(pd);
          continue;
        }

        if (pd) seenPhones.add(pd);
        opcoes.push({
          id: `g:${pd || nome.toLowerCase().slice(0, 24)}`,
          nome,
          telefone: tel,
          email: contact.email,
          cpf: null,
          data_nascimento: contact.data_nascimento,
          convenio: null,
          origem: 'google',
        });
      }
    } catch {
      /* contatos opcionais */
    }
  }

  opcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return NextResponse.json({
    opcoes,
    google_contatos_disponivel: googleContatosDisponivel,
  });
}
