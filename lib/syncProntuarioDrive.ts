import {
  createClienteRecord,
  findCliente,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import {
  entradaHash,
  isDuplicateEntrada,
  loadProntuarioEntradas,
  saveProntuarioEntradas,
  type ProntuarioEntrada,
} from '@/lib/prontuarioEntradasDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isSupabaseMissingTableError } from '@/lib/supabaseErrors';

type ProntuarioEntradaRow = {
  id: string;
  clinica_email: string;
  cliente_drive_id: string | null;
  paciente_nome: string;
  telefone: string | null;
  texto: string;
  autor_nome: string;
  created_at?: string;
  sync_drive_at: string | null;
};

async function pushEntradaToDrive(
  accessToken: string,
  entrada: ProntuarioEntradaRow,
): Promise<string> {
  const ownerEmail = entrada.clinica_email.toLowerCase().trim();
  const store = await loadClientesStore(accessToken, ownerEmail);

  let cliente = entrada.cliente_drive_id
    ? findCliente(store, entrada.cliente_drive_id)
    : undefined;

  if (!cliente) {
    cliente = findClienteByContato(store, {
      telefone: entrada.telefone,
    });
  }

  let clienteCriado = false;
  if (!cliente) {
    cliente = createClienteRecord({
      nome: entrada.paciente_nome,
      telefone: entrada.telefone,
    });
    store.clientes.push(cliente);
    clienteCriado = true;
  } else if (entrada.paciente_nome && !cliente.nome) {
    cliente.nome = entrada.paciente_nome;
    cliente.updated_at = new Date().toISOString();
    clienteCriado = true;
  }

  const created = entrada.created_at ? new Date(entrada.created_at) : new Date();
  const data = Number.isNaN(created.getTime())
    ? new Date().toISOString().slice(0, 10)
    : created.toISOString().slice(0, 10);
  const hora = Number.isNaN(created.getTime())
    ? null
    : `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;

  const entradaDrive: ProntuarioEntrada = {
    id: entrada.id,
    data,
    hora,
    medico: entrada.autor_nome,
    texto: entrada.texto,
    tipo: 'evolucao',
    campos: {},
    origem: 'medico_portal',
    hash_linha: entradaHash({
      data,
      hora,
      medico: entrada.autor_nome,
      texto: entrada.texto,
    }),
  };

  const prontStore = await loadProntuarioEntradas(accessToken, cliente.id);
  if (!isDuplicateEntrada(prontStore.entradas, entradaDrive.hash_linha!)) {
    prontStore.entradas.push(entradaDrive);
    await saveProntuarioEntradas(accessToken, cliente.id, prontStore);
  }

  if (clienteCriado) {
    await saveClientesStore(accessToken, store);
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('prontuario_entradas')
    .update({
      sync_drive_at: now,
      cliente_drive_id: cliente.id,
    })
    .eq('id', entrada.id);

  if (entrada.telefone) {
    await upsertPacienteIndex({
      ownerEmail,
      telefone: entrada.telefone,
      nome: cliente.nome || entrada.paciente_nome,
      clienteDriveId: cliente.id,
    });
  }

  return cliente.id;
}

export async function syncProntuarioEntradaById(
  entradaId: string,
): Promise<{ synced: boolean; clienteDriveId?: string }> {
  const { data: entrada, error } = await supabaseAdmin
    .from('prontuario_entradas')
    .select('*')
    .eq('id', entradaId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { synced: false };
    throw error;
  }
  if (!entrada) return { synced: false };
  if (entrada.sync_drive_at) {
    return {
      synced: true,
      clienteDriveId: entrada.cliente_drive_id ?? undefined,
    };
  }

  const accessToken = await getOwnerDriveAccessToken(entrada.clinica_email);
  if (!accessToken) return { synced: false };

  try {
    const clienteDriveId = await pushEntradaToDrive(
      accessToken,
      entrada as ProntuarioEntradaRow,
    );
    return { synced: true, clienteDriveId };
  } catch (err) {
    console.error('[syncProntuarioDrive] entrada', entradaId, err);
    return { synced: false };
  }
}

export async function syncPendingProntuarioForOwner(
  ownerEmail: string,
  accessToken?: string | null,
): Promise<number> {
  const email = ownerEmail.toLowerCase().trim();
  const token = accessToken ?? (await getOwnerDriveAccessToken(email));
  if (!token) return 0;

  const { data: pendentes, error } = await supabaseAdmin
    .from('prontuario_entradas')
    .select('*')
    .eq('clinica_email', email)
    .is('sync_drive_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return 0;
    throw error;
  }
  if (!pendentes?.length) return 0;

  let count = 0;
  for (const entrada of pendentes) {
    try {
      await pushEntradaToDrive(token, entrada as ProntuarioEntradaRow);
      count++;
    } catch (err) {
      console.error('[syncProntuarioDrive] pendente', entrada.id, err);
    }
  }

  return count;
}
