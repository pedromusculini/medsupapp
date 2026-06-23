/** Incremente ao alterar passos ou fluxo do tour. */
export const TOUR_VERSION = '2026-06-19';
export const TOUR_STORAGE_KEY = 'medsup_product_tour';

export type TourStep = {
  id: string;
  /** Rota onde o passo é exibido (pathname exato ou prefixo com * no final). */
  route: string;
  /** Seletor CSS; omitir para popover centralizado. */
  element?: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Só titular da clínica vê este passo (ex.: Financeiro). */
  titularOnly?: boolean;
};

export const PRODUCT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    title: 'Bem-vindo ao MedSupAPP',
    description:
      'Este tour mostra as principais áreas do sistema: agenda, pacientes, comunicação WhatsApp, backup e configurações. Você pode pausar a qualquer momento ou rever depois em Configurações → Ajuda e suporte.',
  },
  {
    id: 'nav',
    route: '/dashboard',
    element: '[data-tour="main-nav"]',
    title: 'Navegação principal',
    description:
      'Use o menu para ir ao Dashboard, Agenda, Pacientes, Financeiro (titular da clínica), Backup e Configurações. No celular, os atalhos ficam na barra inferior.',
    side: 'bottom',
  },
  {
    id: 'lembretes',
    route: '/dashboard',
    element: '[data-tour="lembretes-whatsapp"]',
    title: 'Lembretes WhatsApp',
    description:
      'Consultas com lembrete ativado aparecem aqui. O envio é semi-manual: você abre o WhatsApp (wa.me) com a mensagem pronta. Personalize os textos em Configurações → Mensagens.',
    side: 'bottom',
  },
  {
    id: 'atendimentos-hoje',
    route: '/dashboard',
    element: '[data-tour="atendimentos-hoje"]',
    title: 'Atendimentos de hoje',
    description:
      'Veja as consultas do dia e finalize com prontuário, valor e sincronização com agenda e financeiro.',
    side: 'top',
  },
  {
    id: 'atendimento-avulso-dash',
    route: '/dashboard',
    element: '[data-tour="atendimento-avulso-dash"]',
    title: 'Atendimento avulso',
    description:
      'Para paciente sem consulta agendada: registre atendimento, prontuário e pagamento em um fluxo único.',
    side: 'top',
  },
  {
    id: 'agenda-intro',
    route: '/agenda',
    element: '[data-tour="agenda-header"]',
    title: 'Agenda clínica',
    description:
      'Calendário local integrado ao Google Calendar (quando conectado). Toque em um horário para agendar; clique em consulta existente para editar ou finalizar.',
    side: 'bottom',
  },
  {
    id: 'agenda-calendar',
    route: '/agenda',
    element: '[data-tour="agenda-calendar"]',
    title: 'Grade da agenda',
    description:
      'Visualize dia, semana ou mês. No celular, prefira a vista “Dia” para agendar com precisão.',
    side: 'left',
  },
  {
    id: 'agenda-autoimport',
    route: '/agenda',
    element: '[data-tour="agenda-autoimport"]',
    title: 'Autoagendamento online',
    description:
      'Quando pacientes reservam pelo link público, importe as reservas aqui para sincronizar com pacientes e agenda.',
    side: 'right',
  },
  {
    id: 'clientes-intro',
    route: '/clientes',
    element: '[data-tour="clientes-header"]',
    title: 'Pacientes',
    description:
      'Cadastros ficam no seu Google Drive. Busque, filtre por quem já teve atendimento e abra a ficha completa com prontuário e histórico.',
    side: 'bottom',
  },
  {
    id: 'clientes-actions',
    route: '/clientes',
    element: '[data-tour="clientes-actions"]',
    title: 'Importações e atalhos',
    description:
      'Importe formulários preenchidos online, gere link de anamnese, importe contatos do Google (busca com Enter), unifique cadastros duplicados e lance atendimento avulso.',
    side: 'bottom',
  },
  {
    id: 'financeiro',
    route: '/financeiro',
    element: '[data-tour="financeiro-header"]',
    title: 'Financeiro',
    description:
      'Controle receitas e despesas. Os dados são armazenados no seu Google Drive, isolados por conta.',
    side: 'bottom',
    titularOnly: true,
  },
  {
    id: 'backup',
    route: '/backup',
    element: '[data-tour="backup-header"]',
    title: 'Backup',
    description:
      'Exporte CSV e arquivos para o Google Drive. Recomendamos backup periódico — você é responsável pela guarda dos prontuários (CFM/LGPD).',
    side: 'bottom',
  },
  {
    id: 'config-nav',
    route: '/dashboard/configuracoes',
    element: '[data-tour="config-nav"]',
    title: 'Configurações',
    description:
      'Mensagens WhatsApp, horários de atendimento, links públicos (cadastro e agendamento) e pagamento/taxas.',
    side: 'bottom',
  },
  {
    id: 'config-mensagens',
    route: '/dashboard/configuracoes',
    element: '[data-tour="config-mensagens"]',
    title: 'Mensagens WhatsApp',
    description:
      'Edite templates com variáveis bloqueadas (nome, data, links). O sistema substitui na hora do envio manual pelo wa.me.',
    side: 'top',
  },
  {
    id: 'config-links',
    route: '/dashboard/configuracoes',
    element: '[data-tour="config-links"]',
    title: 'Links públicos',
    description:
      'Compartilhe o link de autocadastro de pacientes e o de agendamento online. Pacientes preenchem formulários que você importa em Pacientes.',
    side: 'top',
  },
  {
    id: 'perfil',
    route: '/dashboard/perfil',
    element: '[data-tour="perfil-header"]',
    title: 'Meu perfil',
    description:
      'Dados profissionais, endereço da clínica, médicos da equipe e integração Google (Drive, Calendar, Contatos).',
    side: 'bottom',
  },
  {
    id: 'bug-report',
    route: '/dashboard',
    element: '[data-tour="report-bug"]',
    title: 'Reportar bug',
    description:
      'Encontrou um problema? Use o botão “Reportar bug” no topo — abre um e-mail para suporte@medsupapp.com.br com contexto da página.',
    side: 'bottom',
  },
  {
    id: 'done',
    route: '/dashboard',
    title: 'Tour concluído',
    description:
      'Pronto! Revise Privacidade e Termos no rodapé. Para rever este tour: Configurações → Ajuda e suporte → Ver tour novamente.',
  },
];

export type TourState = {
  version: string;
  stepIndex: number;
  status: 'active' | 'completed' | 'dismissed';
};

export function getTourState(): TourState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TourState;
  } catch {
    return null;
  }
}

export function setTourState(state: TourState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
}

export function startProductTour(fromStep = 0): void {
  setTourState({ version: TOUR_VERSION, stepIndex: fromStep, status: 'active' });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('medsup-tour-start'));
  }
}

export function dismissProductTour(): void {
  const current = getTourState();
  setTourState({
    version: TOUR_VERSION,
    stepIndex: current?.stepIndex ?? 0,
    status: 'dismissed',
  });
}

export function completeProductTour(): void {
  setTourState({
    version: TOUR_VERSION,
    stepIndex: PRODUCT_TOUR_STEPS.length,
    status: 'completed',
  });
}

export function shouldAutoStartTour(): boolean {
  const state = getTourState();
  if (!state) return true;
  if (state.version !== TOUR_VERSION) return true;
  if (state.status === 'completed' || state.status === 'dismissed') return false;
  return state.status === 'active';
}

export function routeMatches(stepRoute: string, pathname: string, search = ''): boolean {
  const full = pathname + search;
  if (stepRoute.includes('?')) {
    return full.startsWith(stepRoute) || pathname + search === stepRoute;
  }
  if (stepRoute.endsWith('*')) {
    return pathname.startsWith(stepRoute.slice(0, -1));
  }
  return pathname === stepRoute || pathname.startsWith(`${stepRoute}/`);
}

export function getFilteredSteps(titular: boolean | null): TourStep[] {
  return PRODUCT_TOUR_STEPS.filter((s) => !s.titularOnly || titular === true);
}

export function getStepRoute(step: TourStep): string {
  if (step.id === 'config-links') return '/dashboard/configuracoes?tab=link';
  if (step.id === 'config-mensagens' || step.id === 'config-nav') return '/dashboard/configuracoes';
  return step.route;
}
