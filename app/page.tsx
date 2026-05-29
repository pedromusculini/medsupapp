'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, MessageCircle, DollarSign, Lock, LayoutDashboard } from 'lucide-react';
import LandingBrandAnimation from '@/components/LandingBrandAnimation';

/** Landing page pública — sempre visível em / (sem redirecionar para login/dashboard). */
export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setEmailVerified(false);
      return;
    }
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((data) => setEmailVerified(data.accessVerified === true))
      .catch(() => setEmailVerified(false));
  }, [isAuthenticated]);

  return (
    <main className="bg-white">
      {isAuthenticated && (
        <div className="bg-[#f4fff4] border-b border-[#90EE90]/40 px-6 py-3">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-[#2d652d]">
              Você está conectado como <strong>{session.user?.email}</strong>
            </p>
            {emailVerified ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#013a01] px-4 py-2 font-semibold text-white hover:bg-[#025201] transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Abrir painel
              </Link>
            ) : (
              <Link
                href="/auth/verificar-email"
                className="inline-flex items-center gap-2 rounded-xl border border-[#228B22] px-4 py-2 font-semibold text-[#013a01] hover:bg-white transition"
              >
                Confirmar e-mail
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#013a01] text-white py-20 md:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <LandingBrandAnimation />
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight">
            Consultório organizado.
            <br />
            Sem complicações.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-green-100">
            Agenda eficiente, lembretes automáticos, financeiro integrado e total conformidade com
            LGPD. Desenvolvido para médicos que querem mais tempo para atender pacientes.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-white text-[#013a01] font-semibold py-4 px-10 text-lg shadow-lg hover:bg-gray-100 transition"
            >
              Entrar com Google
            </Link>
            <Link
              href="/planos"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white text-white font-semibold py-4 px-10 text-lg hover:bg-white/10 transition"
            >
              Ver planos
            </Link>
          </div>

          <p className="mt-6 text-sm text-green-200">
            ✓ Sem cartão de crédito • ✓ Cancelamento a qualquer momento • ✓ Suporte por email
          </p>
        </div>
      </section>

      {/* Benefícios Section */}
      <section className="px-6 py-20 lg:py-32 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Por que escolher MedSupAPP?</h2>
            <p className="mt-4 text-lg text-gray-600">
              Soluções práticas para problemas reais do dia a dia
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <div className="flex h-12 w-12 items-center justify-center bg-green-100 rounded-2xl mb-6">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Redução de Glosas</h3>
              <p className="mt-3 text-gray-600">
                Integração com TISS ajuda a reduzir rejeições e agiliza o recebimento das consultas.
              </p>
              <p className="mt-6 text-sm font-medium text-green-600">
                Muitos consultórios reduzem custos administrativos em até 40%
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <div className="flex h-12 w-12 items-center justify-center bg-green-100 rounded-2xl mb-6">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Agenda Inteligente</h3>
              <p className="mt-3 text-gray-600">
                Sincronização com Google Calendar e controle de múltiplos médicos em um único lugar.
              </p>
              <p className="mt-6 text-sm font-medium text-green-600">
                Menos sobreposições e horários ociosos
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <div className="flex h-12 w-12 items-center justify-center bg-green-100 rounded-2xl mb-6">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Lembretes por WhatsApp</h3>
              <p className="mt-3 text-gray-600">
                Mensagens automáticas reduzem faltas e melhoram a organização da agenda.
              </p>
              <p className="mt-6 text-sm font-medium text-green-600">
                Redução média de faltas em 30-40%
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <div className="flex h-12 w-12 items-center justify-center bg-green-100 rounded-2xl mb-6">
                <Lock className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Compliance LGPD</h3>
              <p className="mt-3 text-gray-600">
                Seus dados e dos pacientes protegidos com segurança e conformidade legal.
              </p>
              <p className="mt-6 text-sm font-medium text-green-600">
                100% dentro da legislação vigente
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="bg-gray-50 py-20 lg:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Como funciona?</h2>
            <p className="mt-4 text-lg text-gray-600">3 passos simples para começar</p>
          </div>

          <div className="space-y-16">
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                1
              </div>
              <div>
                <h3 className="text-2xl font-semibold">Cadastre sua clínica</h3>
                <p className="mt-2 text-gray-600">
                  2 minutos usando Google. Sem burocracia desnecessária.
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                2
              </div>
              <div>
                <h3 className="text-2xl font-semibold">Importe sua agenda</h3>
                <p className="mt-2 text-gray-600">
                  Sincronize com Google Calendar ou CSV. Seus pacientes continuam agendados
                  normalmente.
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                3
              </div>
              <div>
                <h3 className="text-2xl font-semibold">Aproveite os recursos</h3>
                <p className="mt-2 text-gray-600">
                  Lembretes, financeiro, relatórios e tudo mais durante os 30 dias de teste.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-[#013a01] py-20 text-white">
        <div className="mx-auto max-w-3xl text-center px-6">
          <h2 className="text-4xl font-bold">Comece hoje com 30 dias grátis</h2>
          <p className="mt-4 text-lg text-green-100">
            Sem cartão. Sem compromisso. Teste tudo que o sistema oferece.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-block bg-white text-[#013a01] font-semibold px-10 py-4 rounded-2xl text-lg hover:bg-gray-100 transition"
            >
              Entrar com Google — 30 dias grátis
            </Link>
            <Link
              href="/planos"
              className="inline-block border-2 border-white text-white font-semibold px-10 py-4 rounded-2xl text-lg hover:bg-white/10 transition"
            >
              Comparar planos
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
