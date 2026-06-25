import {
  createClienteRecord,
  findCliente,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import { isValidPhone, normalizePhoneForStorage } from '@/lib/phone';
import { parsePacienteSel } from '@/lib/pacienteOpcoesUi';

export type ResolvePacienteInput = {
  nome: string;
  telefone?: string | null;
  cliente_id?: string | null;
  paciente_sel?: string | null;
};

export async function resolveOrCreatePacienteCliente(
  accessToken: string,
  ownerEmail: string,
  input: ResolvePacienteInput,
): Promise<ClienteDriveRecord> {
  const store = await loadClientesStore(accessToken, ownerEmail);
  const nome = String(input.nome ?? '').trim();
  const telefoneNorm = input.telefone?.trim()
    ? normalizePhoneForStorage(input.telefone)
    : null;

  let clienteId = input.cliente_id?.trim() || null;
  if (!clienteId && input.paciente_sel) {
    const { driveId } = parsePacienteSel(input.paciente_sel);
    if (driveId) clienteId = driveId;
  }

  if (clienteId) {
    const existente = findCliente(store, clienteId);
    if (!existente) throw new Error('Cliente não encontrado');
    if (telefoneNorm && !existente.telefone) existente.telefone = telefoneNorm;
    if (nome.length >= 2 && existente.nome !== nome) existente.nome = nome;
    await saveClientesStore(accessToken, store);
    return existente;
  }

  if (telefoneNorm && isValidPhone(telefoneNorm)) {
    const porTel = findClienteByContato(store, { telefone: telefoneNorm });
    if (porTel) {
      if (!porTel.telefone) porTel.telefone = telefoneNorm;
      if (nome.length >= 2) porTel.nome = nome;
      await saveClientesStore(accessToken, store);
      return porTel;
    }
  }

  if (nome.length < 2) {
    throw new Error('Informe o nome do paciente (mín. 2 caracteres)');
  }

  if (input.paciente_sel) {
    const { driveId } = parsePacienteSel(input.paciente_sel);
    if (driveId) {
      throw new Error(
        'Paciente selecionado não encontrado no cadastro. Recarregue a lista de pacientes e tente novamente.',
      );
    }
  }

  const novo = createClienteRecord({
    nome,
    telefone: telefoneNorm,
    observacoes_gerais: '[Cadastro automático — agenda / consulta]',
  });
  store.clientes.push(novo);
  await saveClientesStore(accessToken, store);
  return novo;
}
