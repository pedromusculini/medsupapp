import type { BackupDrivePayload } from '@/lib/backupDriveExport';
import type { BackupSectionId } from '@/lib/backupCatalog';

const SECTION_TITLES: Record<BackupSectionId, string> = {
  consultas_agenda: 'CONSULTAS (já na seção agenda)',
  financeiro_transacoes: 'FINANCEIRO (DRIVE — faturamento.json)',
  clientes_cadastro: 'PACIENTES — CADASTRO COMPLETO (clientes.json)',
  clientes_atendimentos: 'PACIENTES — ATENDIMENTOS',
  clientes_pagamentos: 'PACIENTES — PAGAMENTOS',
  clientes_observacoes: 'PACIENTES — OBSERVAÇÕES ADMINISTRATIVAS',
  prontuario_anotacoes: 'PRONTUÁRIO — ANOTAÇÕES LEGADAS',
  prontuario_entradas: 'PRONTUÁRIO — EVOLUÇÕES (entradas.json)',
  prontuario_series: 'PRONTUÁRIO — SÉRIES GRÁFICOS',
  prontuario_import_mappings: 'PRONTUÁRIO — MAPEAMENTOS CSV',
  equipe_medicos: 'EQUIPE MÉDICA',
  mensagens_whatsapp: 'MENSAGENS WHATSAPP',
  lembretes_whatsapp: 'LEMBRETES WHATSAPP',
  perfil_conta: 'PERFIL DA CONTA',
};

export function backupSectionJsonFilename(
  exportadoEm: string,
  sectionId: string,
): string {
  const stamp = exportadoEm.slice(0, 10) || 'data';
  return `backup_${stamp}_${sectionId}.json`;
}

export function buildBackupSectionJsonFiles(
  payload: BackupDrivePayload | null,
): { name: string; content: string }[] {
  if (!payload?.sections) return [];
  const stamp = payload.exportado_em.slice(0, 10);
  return Object.entries(payload.sections).map(([key, value]) => ({
    name: `backup_${stamp}_${key}.json`,
    content: JSON.stringify(value, null, 2),
  }));
}

/** Referencia arquivos JSON externos — não embute JSON grande no CSV. */
export function appendBackupSectionsToCsv(
  linhas: string[],
  payload: BackupDrivePayload | null,
  sections: BackupSectionId[],
): void {
  if (!payload?.sections) return;

  const driveSections = sections.filter(
    (id) => id !== 'consultas_agenda' && payload.sections[id] !== undefined,
  );
  if (driveSections.length === 0) return;

  linhas.push('');
  linhas.push('=== DADOS DO DRIVE (ARQUIVOS JSON SEPARADOS) ===');
  linhas.push(
    'Os dados brutos do Drive estão nos arquivos JSON do pacote ZIP (download local) ou na pasta de backup no Google Drive — não neste CSV.',
  );
  linhas.push('Seção;Arquivo JSON');
  for (const id of driveSections) {
    linhas.push(
      `${SECTION_TITLES[id] ?? id.toUpperCase()};${backupSectionJsonFilename(payload.exportado_em, id)}`,
    );
  }

  linhas.push('');
  linhas.push('=== METADADOS BACKUP ===');
  linhas.push(`Exportado em (Drive);${payload.exportado_em}`);
  linhas.push(`Seções incluídas;${sections.join(', ')}`);
}
