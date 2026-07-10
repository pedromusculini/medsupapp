'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Users,
  ArrowRight,
  Stethoscope,
  Building2,
  CalendarDays,
  Wallet,
  HardDrive,
  ChevronRight,
  User,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import LembretesWhatsAppCard from '@/components/LembretesWhatsAppCard';
import GoogleConnectionAlert from '@/components/GoogleConnectionAlert';
import DashboardAgendaHoje from '@/components/DashboardAgendaHoje';
import { useClinicaTitular } from '@/lib/useClinicaTitular';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: CalendarDays },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Pacientes', icon: Users },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/backup', label: 'Backup', icon: HardDrive },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: MessageCircle },
  { href: '/dashboard/perfil', label: 'Meu Perfil', icon: User },
];

function DashboardPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const clinicaTitular = useClinicaTitular();
  const visibleSidebarLinks =
    clinicaTitular === false
      ? sidebarLinks.filter((link) => link.href !== '/financeiro')
      : sidebarLinks;
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) return null;

  const role = (session.user as { role?: string })?.role || 'medico';
  const roleLabel = role === 'medico' ? 'Médico' : 'Clínica';
  const roleIcon = role === 'medico' ? Stethoscope : Building2;
  const RoleIcon = roleIcon;
  const userEmail = session.user?.email ?? '';

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-[73px] left-0 z-50 h-[calc(100vh-73px)]
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}
          lg:translate-x-0 lg:pointer-events-auto
        `}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-600">
              <RoleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{session.user?.name}</p>
              <p className="text-xs text-gray-500">{roleLabel}</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {visibleSidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/dashboard';
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-emerald-200/20 text-emerald-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <Link
            href="/onboarding"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
            Configurar perfil
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="btn-action p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            aria-label="Abrir menu"
          >
            <CalendarDays className="w-5 h-5" />
          </button>
        </div>

        <h1 className="hidden lg:block text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="hidden lg:block text-gray-500 mb-8">
          Bem-vindo de volta, {session.user?.name?.split(' ')[0]}!
        </p>

        <GoogleConnectionAlert redirectPath="/dashboard" className="mb-4" />

        <div className="mb-6">
          <LembretesWhatsAppCard />
        </div>

        <div className="mb-6">
          <DashboardAgendaHoje userEmail={userEmail} />
        </div>

        <Link
          href="/clientes?finalizar=1"
          data-tour="atendimento-avulso-dash"
          className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 transition-colors group"
        >
          <div className="p-3 bg-white/15 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base">Atendimento avulso</p>
            <p className="text-sm text-emerald-100/90 font-normal">
              Paciente sem consulta agendada — prontuário e valor
            </p>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
