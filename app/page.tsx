'use client';

import Link from 'next/link';
import { Check, Calendar, MessageCircle, DollarSign, FileCheck, Lock, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-[#f0fdf4] to-white px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex rounded-full bg-[#d1fae5] px-4 py-2 text-sm font-semibold text-[#059669]">
            🚀 LANÇAMENTO
          </span>
          
          <h1 className="mt-8 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
            Consultório sem <span className="text-[#10b981]">complicações</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
            Agenda automática, lembretes por WhatsApp, financeiro integrado e compliance LGPD. Tudo que você precisa para focar no que importa: seus pacientes.
          </p>
          
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-lg bg-[#10b981] px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-[#059669] hover:shadow-xl"
            >
              Testar 30 dias grátis <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 px-8 py-4 font-semibold text-gray-900 transition hover:border-gray-400 hover:bg-gray-50"
            >
              Já tenho conta
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-gray-500">✓ Sem cartão de crédito • ✓ Acesso completo • ✓ Suporte por email</p>
        </div>
      </section>

      {/* Benefícios Section */}
      <section className="px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900">Por que MedSupAPP?</h2>
            <p className="mt-4 text-lg text-gray-600">Ganhe tempo, reduza custos e aumente sua eficiência</p>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {/* Benefício 1 */}
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-[#f0fdf4] to-white p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Redução de Glosas</h3>
              <p className="mt-2 text-gray-600">
                Integração com TISS automático reduz rejeições e aumenta suas receitas em até 15%.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#10b981]">Economize até R$ 5.000/mês</p>
            </div>

            {/* Benefício 2 */}
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-[#f0fdf4] to-white p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Agenda Inteligente</h3>
              <p className="mt-2 text-gray-600">
                Sincronize com Google Calendar, evite duplicatas e gerencie múltiplos médicos em um lugar.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#10b981]">Economize 5h/semana</p>
            </div>

            {/* Benefício 3 */}
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-[#f0fdf4] to-white p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Lembretes por WhatsApp</h3>
              <p className="mt-2 text-gray-600">
                Reduz faltas em 40%. Mensagens automáticas 7 dias e 1 dia antes da consulta.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#10b981]">Aumento de 40% em comparecimentos</p>
            </div>

            {/* Benefício 4 */}
            <div className="rounded-lg border border-gray-200 bg-linear-to-br from-[#f0fdf4] to-white p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#10b981]">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Compliance LGPD</h3>
              <p className="mt-2 text-gray-600">
                Seus dados seguros, criptografados e em conformidade total com a Lei Geral de Proteção de Dados.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#10b981]">100% seguro e legal</p>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="bg-gray-50 px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900">Como funciona?</h2>
            <p className="mt-4 text-lg text-gray-600">3 passos para começar</p>
          </div>
          
          <div className="mt-16 space-y-12">
            {/* Step 1 */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10b981] text-white font-bold text-lg">
                  1
                </div>
                <div className="mt-4 h-16 w-1 bg-gray-300 md:h-24"></div>
              </div>
              <div className="pb-12">
                <h3 className="text-2xl font-bold text-gray-900">Cadastre sua clínica</h3>
                <p className="mt-2 text-gray-600">
                  2 minutos com Google, informações básicas e pronto. Sem burocracia.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10b981] text-white font-bold text-lg">
                  2
                </div>
                <div className="mt-4 h-16 w-1 bg-gray-300 md:h-24"></div>
              </div>
              <div className="pb-12">
                <h3 className="text-2xl font-bold text-gray-900">Importe sua agenda</h3>
                <p className="mt-2 text-gray-600">
                  Sync automático com Google Calendar ou CSV. Seus pacientes continuam agendados normalmente.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10b981] text-white font-bold text-lg">
                  3
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Aproveite todos os recursos</h3>
                <p className="mt-2 text-gray-600">
                  Lembretes automáticos, financeiro, relatórios e tudo mais sem limite durante 30 dias.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900">Planos que crescem com você</h2>
            <p className="mt-4 text-lg text-gray-600">30 dias grátis. Nenhum cartão necessário.</p>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Free Trial */}
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">Experimentar</h3>
                <p className="mt-2 text-sm text-gray-600">30 dias</p>
              </div>
              <div className="mt-6 text-center">
                <span className="text-4xl font-bold text-gray-900">R$0</span>
                <p className="text-sm text-gray-600">/mês</p>
              </div>
              <button className="mt-8 w-full rounded-lg border-2 border-[#10b981] py-3 font-semibold text-[#10b981] transition hover:bg-[#f0fdf4]">
                Começar agora
              </button>
              <div className="mt-8 space-y-3">
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Agenda ilimitada
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Lembretes WhatsApp
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Acesso completo
                </p>
              </div>
            </div>

            {/* Basic */}
            <div className="rounded-lg border-2 border-[#10b981] bg-linear-to-b from-[#f0fdf4] to-white p-8 shadow-lg">
              <div className="text-center">
                <span className="inline-block rounded-full bg-[#10b981] px-3 py-1 text-xs font-bold text-white">
                  MAIS POPULAR
                </span>
              </div>
              <div className="mt-6 text-center">
                <h3 className="text-xl font-bold text-gray-900">Consultório</h3>
                <p className="mt-2 text-sm text-gray-600">Até 3 médicos</p>
              </div>
              <div className="mt-6 text-center">
                <span className="text-4xl font-bold text-gray-900">R$89</span>
                <p className="text-sm text-gray-600">/mês</p>
              </div>
              <button className="mt-8 w-full rounded-lg bg-[#10b981] py-3 font-semibold text-white transition hover:bg-[#059669]">
                Começar agora
              </button>
              <div className="mt-8 space-y-3">
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Até 3 médicos
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> TISS automático
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Suporte por email
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Integração WhatsApp
                </p>
              </div>
            </div>

            {/* Pro */}
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">Pro</h3>
                <p className="mt-2 text-sm text-gray-600">Até 10 médicos</p>
              </div>
              <div className="mt-6 text-center">
                <span className="text-4xl font-bold text-gray-900">R$189</span>
                <p className="text-sm text-gray-600">/mês</p>
              </div>
              <button className="mt-8 w-full rounded-lg border-2 border-[#10b981] py-3 font-semibold text-[#10b981] transition hover:bg-[#f0fdf4]">
                Começar agora
              </button>
              <div className="mt-8 space-y-3">
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Até 10 médicos
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Suporte prioritário
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> Relatórios avançados
                </p>
                <p className="flex items-center text-sm text-gray-700">
                  <Check className="mr-3 h-5 w-5 text-[#10b981]" /> API de integração
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900">O que os médicos dizem</h2>
            <p className="mt-4 text-lg text-gray-600">Histórias reais de consultórios que economizaram tempo e dinheiro</p>
          </div>
          
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Testimonial 1 */}
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>
              <p className="mt-4 text-gray-700">
                "Antes perdia 2h por semana com agendamentos. Agora demora 10 minutos. O ROI saiu em 2 semanas!"
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#10b981]"></div>
                <div>
                  <p className="font-semibold text-gray-900">Dra. Marina Silva</p>
                  <p className="text-sm text-gray-600">Dermatologista - São Paulo</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>
              <p className="mt-4 text-gray-700">
                "Redução de glosas de 12% no primeiro mês. Financeiro muito mais organizado. Vale cada real."
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#10b981]"></div>
                <div>
                  <p className="font-semibold text-gray-900">Dr. Felipe Costa</p>
                  <p className="text-sm text-gray-600">Cardiologista - Rio de Janeiro</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>
              <p className="mt-4 text-gray-700">
                "Lembretes por WhatsApp reduziram faltas em 35%. Pacientes felizes, agenda mais cheia!"
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#10b981]"></div>
                <div>
                  <p className="font-semibold text-gray-900">Dra. Ana Paula</p>
                  <p className="text-sm text-gray-600">Clínica Geral - Belo Horizonte</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-linear-to-r from-[#10b981] to-[#059669] px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold text-white">Comece hoje. 30 dias grátis.</h2>
          <p className="mt-4 text-lg text-green-50">
            Nenhum cartão necessário. Acesso completo. Você decide após o período de teste.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center rounded-lg bg-white px-8 py-4 font-semibold text-[#10b981] shadow-lg transition hover:bg-gray-50"
          >
            Testar 30 dias grátis <ChevronRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-4">
            <div>
              <h3 className="font-bold text-gray-900">MedSupAPP</h3>
              <p className="mt-2 text-sm text-gray-600">Consultório sem complicações.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Produto</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-[#10b981]">Agenda</Link></li>
                <li><Link href="#" className="hover:text-[#10b981]">Financeiro</Link></li>
                <li><Link href="#" className="hover:text-[#10b981]">WhatsApp</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Legal</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-[#10b981]">Privacidade</Link></li>
                <li><Link href="#" className="hover:text-[#10b981]">Termos</Link></li>
                <li><Link href="#" className="hover:text-[#10b981]">LGPD</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Conta</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link href="/login" className="hover:text-[#10b981]">Login</Link></li>
                <li><Link href="/onboarding" className="hover:text-[#10b981]">Começar grátis</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-center text-sm text-gray-600">
              © 2026 MedSupAPP. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
