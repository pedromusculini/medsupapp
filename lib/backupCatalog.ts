/** Catálogo de seções exportáveis no backup — nenhuma categoria fica de fora. */

export type BackupSectionId =
  | 'consultas_agenda'
  | 'financeiro_transacoes'
  | 'clientes_cadastro'
  | 'clientes_atendimentos'
  | 'clientes_pagamentos'
  | 'clientes_observacoes'
  | 'prontuario_anotacoes'
  | 'prontuario_entradas'
  | 'prontuario_series'
  | 'prontuario_import_mappings'
  | 'equipe_medicos'
  | 'mensagens_whatsapp'
  | 'lembretes_whatsapp'
  | 'perfil_conta';

export type BackupSectionDef = {
  id: BackupSectionId;
  label: string;
  description: string;
  /** Exige PIN do prontuário (dados clínicos). */
  sensitive: boolean;
  /** Só relevante para contas tipo clínica. */
  clinicaOnly?: boolean;
  defaultEnabled: boolean;
};

export const BACKUP_SECTIONS: BackupSectionDef[] = [
  {
    id: 'consultas_agenda',
    label: 'Consultas (agenda)',
    description: 'Eventos da agenda local: paciente, serviço, convênio, status, valor, datas.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'financeiro_transacoes',
    label: 'Financeiro',
    description: 'Transações, categorias, splits por médico e totais.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'clientes_cadastro',
    label: 'Pacientes — cadastro',
    description: 'Nome, contato, CPF, nascimento, convênio e observações gerais.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'clientes_atendimentos',
    label: 'Pacientes — atendimentos',
    description: 'Histórico de atendimentos por paciente (sem texto clínico).',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'clientes_pagamentos',
    label: 'Pacientes — pagamentos',
    description: 'Pagamentos vinculados aos pacientes.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'clientes_observacoes',
    label: 'Pacientes — observações administrativas',
    description: 'Observações não clínicas da ficha.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'prontuario_anotacoes',
    label: 'Prontuário — anotações legadas',
    description:
      'Observações com prefixo [Prontuário] ainda não migradas (somente leitura; use entradas.json).',
    sensitive: true,
    defaultEnabled: false,
  },
  {
    id: 'prontuario_entradas',
    label: 'Prontuário — evoluções (Drive)',
    description: 'Fonte de verdade: entradas.json por paciente (manual, portal, import CSV).',
    sensitive: true,
    defaultEnabled: true,
  },
  {
    id: 'prontuario_series',
    label: 'Prontuário — séries para gráficos',
    description: 'Medidas numéricas (peso, PA, etc.) em series.json.',
    sensitive: true,
    defaultEnabled: true,
  },
  {
    id: 'prontuario_import_mappings',
    label: 'Prontuário — mapeamentos CSV',
    description: 'Configuração de importação personalizada.',
    sensitive: true,
    defaultEnabled: true,
  },
  {
    id: 'equipe_medicos',
    label: 'Equipe médica',
    description: 'Profissionais cadastrados na clínica.',
    sensitive: false,
    clinicaOnly: true,
    defaultEnabled: true,
  },
  {
    id: 'mensagens_whatsapp',
    label: 'Mensagens WhatsApp',
    description: 'Templates de comunicação configurados.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'lembretes_whatsapp',
    label: 'Lembretes WhatsApp',
    description: 'Configuração de lembretes automáticos.',
    sensitive: false,
    defaultEnabled: true,
  },
  {
    id: 'perfil_conta',
    label: 'Perfil da conta',
    description: 'Dados do titular e tipo de conta (médico/clínica).',
    sensitive: false,
    defaultEnabled: true,
  },
];

export const BACKUP_SECTION_IDS = BACKUP_SECTIONS.map((s) => s.id);

export const DEFAULT_BACKUP_SECTIONS: BackupSectionId[] = BACKUP_SECTIONS.filter(
  (s) => s.defaultEnabled,
).map((s) => s.id);

export function isSensitiveBackupSection(id: BackupSectionId): boolean {
  return BACKUP_SECTIONS.find((s) => s.id === id)?.sensitive ?? false;
}

export function sectionsRequireProntuarioPin(sectionIds: BackupSectionId[]): boolean {
  return sectionIds.some(isSensitiveBackupSection);
}
