import { SUPPORT_EMAIL } from '@/lib/legal';

export type BugReportContext = {
  page?: string;
  userEmail?: string;
  userAgent?: string;
};

/** Abre o cliente de e-mail com assunto e contexto pré-preenchidos. */
export function buildBugReportMailto(context?: BugReportContext): string {
  const subject = encodeURIComponent('[MedSupAPP] Reportar bug');
  const lines = [
    'Descreva o problema (o que você esperava vs. o que aconteceu):',
    '',
    '',
    '---',
    `Página: ${context?.page ?? (typeof window !== 'undefined' ? window.location.href : '')}`,
    context?.userEmail ? `Conta: ${context.userEmail}` : '',
    context?.userAgent ? `Navegador: ${context.userAgent}` : '',
    `Data: ${new Date().toISOString()}`,
  ].filter(Boolean);
  const body = encodeURIComponent(lines.join('\n'));
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

export function openBugReport(context?: BugReportContext): void {
  if (typeof window === 'undefined') return;
  window.location.href = buildBugReportMailto({
    ...context,
    userAgent: context?.userAgent ?? navigator.userAgent,
    page: context?.page ?? window.location.href,
  });
}
