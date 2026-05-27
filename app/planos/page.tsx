'use client';

import { useState } from 'react';
import Link from 'next/link';

const plans = [
  {
    name: 'Solo',
    price: 'R$ 119',
    description: 'Para profissionais autônomos',
    features: [
      'Prontuário eletrônico ilimitado',
      'Agenda inteligente',
      'Receitas e atestados digitais',
      'Suporte por e-mail',
    ],
    cta: 'Começar 30 dias grátis',
    popular: false,
  },
  {
    name: 'Clínica',
    price: 'R$ 319',
    description: 'Até 5 médicos',
    features: [
      'Tudo do plano Solo',
      'Gestão de múltiplos profissionais',
      'Relatórios financeiros',
      'Suporte prioritário',
    ],
    cta: 'Começar 30 dias grátis',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'R$ 449',
    description: 'Até 10 médicos',
    features: [
      'Tudo do plano Clínica',
      'API de integração',
      'Onboarding dedicado',
      'Suporte 24h',
    ],
    cta: 'Começar 30 dias grátis',
    popular: false,
  },
];

export default function PlanosPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = async (planName: string) => {
    setSelectedPlan(planName);
    setLoading(true);
    // Simulate redirect to checkout or trial activation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    // In production, redirect to checkout page
    // router.push(`/checkout?plan=${planName}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-[#10b981]">
            MedSupAPP
          </Link>
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-600 hover:text-[#10b981]">
              Início
            </Link>
            <Link href="/planos" className="text-[#10b981] font-semibold">
              Planos
            </Link>
            <Link href="/auth/login" className="text-gray-600 hover:text-[#10b981]">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Escolha o plano ideal para você
          </h1>
          <p className="text-xl text-green-100 max-w-2xl mx-auto">
            Experimente gratuitamente por 30 dias. Sem cartão de crédito. Cancele quando quiser.
          </p>
          <div className="mt-8 inline-flex items-center bg-white/20 rounded-full px-6 py-3">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">30 dias grátis · Sem compromisso</span>
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                plan.popular ? 'ring-2 ring-[#10b981]' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-[#10b981] text-white px-4 py-1 rounded-bl-lg text-sm font-semibold">
                  Mais popular
                </div>
              )}
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-500 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 ml-2">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <svg className="w-5 h-5 text-[#10b981] mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={loading && selectedPlan === plan.name}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    plan.popular
                      ? 'bg-[#10b981] hover:bg-[#059669]'
                      : 'bg-gray-800 hover:bg-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading && selectedPlan === plan.name ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processando...
                    </span>
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trial Info */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center bg-green-50 rounded-full px-6 py-3">
            <svg className="w-5 h-5 text-[#10b981] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[#10b981] font-semibold">
              Sem cartão de crédito necessário. Cancele a qualquer momento durante o trial.
            </span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Perguntas frequentes
          </h2>
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Preciso de cartão de crédito para começar o trial?
              </h3>
              <p className="text-gray-600">
                Não. Você pode experimentar gratuitamente por 30 dias sem fornecer dados de pagamento.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Posso cancelar durante o trial?
              </h3>
              <p className="text-gray-600">
                Sim, você pode cancelar a qualquer momento durante os 30 dias sem custos.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                O que acontece após o trial?
              </h3>
              <p className="text-gray-600">
                Se você não cancelar, o plano escolhido será ativado automaticamente. Você pode cancelar antes do fim do trial.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">&copy; 2026 MedSupAPP. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
