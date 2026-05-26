 'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Building2,
  CheckCircle,
  Clock3,
  Mail,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

const initialFormState = {
  fullName: '',
  crm: '',
  cpf: '',
  cnpj: '',
  doctorsCount: '2',
  birthDate: '',
  whatsapp: '',
  address: '',
  clinicName: '',
  healthPlan: '',
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'plan' | 'form' | 'verify'>('type');
  const [userType, setUserType] = useState<'medico' | 'clinica' | ''>('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [form, setForm] = useState(initialFormState);
  const [typedCode, setTypedCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    try {
      new URL(supabaseUrl);
      return createClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.error('Supabase URL inválido:', supabaseUrl, err);
      return null;
    }
  }, [supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const t = setTimeout(() => router.replace('/login'), 0);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  useEffect(() => {
    if (expiresAt) {
      const timer = window.setInterval(() => {
        setCurrentTime(Date.now());
        if (new Date() >= expiresAt) {
          setExpiresAt(null);
          window.clearInterval(timer);
        }
      }, 1000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [expiresAt]);

  const stepLabel = useMemo(() => {
    if (step === 'type') return 'Escolha sua conta';
    if (step === 'plan') return 'Escolha seu plano';
    if (step === 'form') return 'Complete seus dados';
    return 'Confirme seu código';
  }, [step]);

  const countdown = useMemo(() => {
    if (!expiresAt) return '05:00';
    const diff = Math.max(0, Math.ceil((expiresAt.getTime() - currentTime) / 1000));
    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
    const seconds = String(diff % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [expiresAt, currentTime]);

  const handleTypeSelect = (type: 'medico' | 'clinica') => {
    setUserType(type);
    setSelectedPlan('');
    setStep('plan');
    setError('');
    setInfoMessage('');
  };

  const handleChange = (field: keyof typeof initialFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setError('');
    setInfoMessage('');
  };

  const handlePaymentClick = (method: 'PIX' | 'Cartão') => {
    setInfoMessage('Integração de pagamento em desenvolvimento - Em breve');
  };

  const handleContinueFromPlan = () => {
    if (!selectedPlan) {
      setError('Selecione um plano para continuar.');
      return;
    }

    setError('');
    setInfoMessage('');
    setStep('form');
  };

  const canSubmitForm = useMemo(() => {
    if (userType === 'medico') {
      return !!(form.fullName.trim() && form.crm.trim() && form.whatsapp.trim() && form.address.trim());
    }
    if (userType === 'clinica') {
      return !!(form.clinicName.trim() && form.cnpj.trim() && form.doctorsCount.trim() && form.whatsapp.trim() && form.address.trim());
    }
    return false;
    return false;
  }, [form, userType]);

  const handleSubmitForm = async () => {
    if (!canSubmitForm) {
      setError('Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }

    if (!session?.user?.email) {
      setError('E-mail do usuário não está disponível. Faça login novamente.');
      return;
    }

    setIsSendingCode(true);
    setError('');
    setInfoMessage('');

    try {
      const response = await fetch('/api/onboarding/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Não foi possível enviar o código por e-mail.');
      }

      setExpiresAt(new Date(Date.now() + 5 * 60 * 1000));
      setTypedCode('');
      setStep('verify');
      setInfoMessage('Código enviado! Verifique seu e-mail e insira o código recebido.');
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível enviar o código por e-mail.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!typedCode.trim()) {
      setError('Digite o código de 4 dígitos enviado para o seu e-mail.');
      return;
    }

    if (new Date() > (expiresAt ?? new Date(0))) {
      setError('O código expirou. Gere um novo para continuar.');
      return;
    }

    if (!session?.user?.email) {
      setError('E-mail do usuário não está disponível. Faça login novamente.');
      return;
    }

    if (!supabase) {
      setError('Configuração do Supabase ausente. Contate o administrador.');
      return;
    }

    setIsVerifyingCode(true);
    setError('');
    try {
      const verificationResponse = await fetch('/api/onboarding/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email, code: typedCode.trim() }),
      });

      const verificationResult = await verificationResponse.json();
      if (!verificationResponse.ok || verificationResult?.error) {
        throw new Error(verificationResult?.error || 'Código inválido.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Código inválido.');
      setIsVerifyingCode(false);
      return;
    }

    setIsVerifyingCode(false);
    setIsSaving(true);

    try {
      const userId = (session?.user as any)?.id ?? session?.user?.email ?? '';

      if (!userId) {
        throw new Error('Usuário não identificado na sessão.');
      }

      const profileRow: any = {
        id: userId,
        email: session.user.email,
        role: userType || null,
        name: userType === 'clinica' ? form.clinicName : form.fullName,
        whatsapp: form.whatsapp,
        address: form.address,
        completed_onboarding: true,
      };

      const { error: profileError } = await supabase.from('profiles').upsert(profileRow);
      if (profileError) throw profileError;

      if (userType === 'medico') {
        const medicoRow = {
          id: userId,
          crm: form.crm,
        };
        const { error: medError } = await supabase.from('medicos').upsert(medicoRow);
        if (medError) throw medError;
      } else if (userType === 'clinica') {
        const clinicaRow = {
          id: userId,
          cnpj: form.cnpj,
          number_of_doctors: Number(form.doctorsCount) || null,
        };
        const { error: clinicError } = await supabase.from('clinicas').upsert(clinicaRow);
        if (clinicError) throw clinicError;
      }

      window.location.replace('/dashboard');
    } catch (err: any) {
      // eslint-disable-next-line no-alert
      alert(err?.message ?? 'Erro ao salvar os dados. Tente novamente.');
      setError(err?.message ?? 'Erro ao salvar os dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!supabaseUrl || !supabaseAnonKey || !supabase) {
    return (
      <div className="min-h-screen bg-[#eafde7] flex items-center justify-center px-4 py-10">
        <div className="max-w-xl rounded-4xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-slate-900">Configuração do Supabase inválida</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Verifique as variáveis de ambiente públicas do Supabase em <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code>.
            Elas devem incluir <span className="font-semibold">NEXT_PUBLIC_SUPABASE_URL</span> e
            <span className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>,
            e o URL precisa ser um endereço válido iniciando com <span className="font-semibold">https://</span>.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="flex items-center justify-center min-h-screen bg-[#eafde7]">Carregando seu onboarding...</div>;
  }

  return (
    <main className="min-h-screen bg-[#eafde7] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-4xl border border-[#d5f1d0] bg-white/95 p-8 shadow-xl shadow-green-200">
        <div className="mb-8 flex flex-col gap-6 rounded-3xl bg-[#90EE90]/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-green-700">Onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Complete seu acesso ao MedSupAPP</h1>
            <p className="mt-2 text-sm text-slate-600">Seu e-mail é <span className="font-medium text-slate-900">{session?.user?.email}</span>.</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
            <ShieldCheck className="h-8 w-8 text-green-700" />
          </div>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          {['Tipo', 'Dados', 'Código'].map((label, index) => {
            const stepIndex = index + 1;
            const activeStep = step === 'type' ? 1 : step === 'form' ? 2 : 3;
            const isActive = stepIndex === activeStep;
            return (
              <div
                key={label}
                className={`rounded-3xl border px-4 py-4 text-center transition ${isActive ? 'border-green-500 bg-green-50 shadow-sm' : 'border-transparent bg-[#f7fff7]'}`}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Etapa {stepIndex}</p>
                <p className="mt-2 font-semibold text-slate-800">{label}</p>
              </div>
            );
          })}
        </div>

        <section className="space-y-6">
          <div className="rounded-3xl border border-green-100 bg-[#f7fff7] p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <Clock3 className="h-5 w-5 text-green-600" />
              <p className="text-sm">O código expira em 5 minutos após ser gerado. Tempo restante: <span className="font-medium">{countdown}</span></p>
            </div>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">{stepLabel}</h2>
              <p className="text-sm text-slate-500">Um fluxo claro e rápido para começar a usar o MedSupAPP.</p>
            </div>

            {step === 'type' && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => handleTypeSelect('medico')}
                  className="flex w-full items-center gap-4 rounded-3xl border border-green-200 bg-[#f3fff3] px-5 py-4 text-left transition hover:border-green-400 hover:bg-[#e8ffe8]"
                >
                  <Stethoscope className="h-6 w-6 text-green-700" />
                  <div>
                    <p className="font-semibold text-slate-900">Médico Solo</p>
                    <p className="text-sm text-slate-500">Perfil para médico independente.</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeSelect('clinica')}
                  className="flex w-full items-center gap-4 rounded-3xl border border-green-200 bg-[#f3fff3] px-5 py-4 text-left transition hover:border-green-400 hover:bg-[#e8ffe8]"
                >
                  <Building2 className="h-6 w-6 text-green-700" />
                  <div>
                    <p className="font-semibold text-slate-900">Clínica</p>
                    <p className="text-sm text-slate-500">Estrutura para 2 a 10 médicos.</p>
                  </div>
                </button>
                {/* Paciente removed: patients are invited by médico/clinica */}
              </div>
            )}
            {step === 'plan' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.24em] text-green-700">Selecione seu plano</p>
                  <h3 className="text-2xl font-semibold text-slate-900">Planos de assinatura</h3>
                  <p className="text-sm text-slate-500">Escolha a opção que melhor combina com sua rotina e tamanho da equipe.</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handlePlanSelect('medico-pix')}
                    className={`rounded-3xl border px-5 py-6 text-left transition ${selectedPlan === 'medico-pix' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-green-200 bg-[#f7fff7]'} ${userType === 'clinica' || userType === 'medico' ? '' : 'cursor-not-allowed opacity-70'}`}
                    disabled={userType !== 'medico' && userType !== 'clinica'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Médico Solo</p>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">PIX</span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-900">R$ 3.990</p>
                    <p className="mt-2 text-sm text-slate-600">ou 12x de R$ 390.</p>
                    <p className="mt-3 text-sm text-slate-600">PIX com desconto à vista.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlanSelect('clinica-5-pix')}
                    className={`rounded-3xl border px-5 py-6 text-left transition ${selectedPlan === 'clinica-5-pix' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-green-200 bg-[#f7fff7]'} ${userType === 'clinica' ? '' : 'cursor-not-allowed opacity-70'}`}
                    disabled={userType !== 'clinica'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Clínica até 5</p>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">PIX</span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-900">R$ 11.990</p>
                    <p className="mt-2 text-sm text-slate-600">ou 12x de R$ 1.199.</p>
                    <p className="mt-3 text-sm text-slate-600">Até 5 médicos.</p>
                    {userType !== 'clinica' && <p className="mt-3 text-xs text-slate-500">Disponível apenas para contas Clínica.</p>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlanSelect('clinica-10-pix')}
                    className={`rounded-3xl border px-5 py-6 text-left transition ${selectedPlan === 'clinica-10-pix' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-green-200 bg-[#f7fff7]'} ${userType === 'clinica' ? '' : 'cursor-not-allowed opacity-70'}`}
                    disabled={userType !== 'clinica'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Clínica até 10</p>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">PIX</span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-900">R$ 19.990</p>
                    <p className="mt-2 text-sm text-slate-600">ou 12x de R$ 1.850.</p>
                    <p className="mt-3 text-sm text-slate-600">Até 10 médicos.</p>
                    {userType !== 'clinica' && <p className="mt-3 text-xs text-slate-500">Disponível apenas para contas Clínica.</p>}
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentClick('PIX')}
                    className="rounded-3xl border border-green-600 bg-green-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Pagar com PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentClick('Cartão')}
                    className="rounded-3xl border border-green-200 bg-white px-6 py-4 text-sm font-semibold text-slate-900 transition hover:bg-[#f7fff7]"
                  >
                    Pagar com Cartão
                  </button>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {infoMessage && <p className="text-sm text-slate-700">{infoMessage}</p>}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <button type="button" onClick={() => setStep('type')} className="rounded-3xl border px-6 py-3 text-sm text-slate-700">Voltar</button>
                  <button
                    type="button"
                    onClick={handleContinueFromPlan}
                    className="rounded-3xl bg-green-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!selectedPlan}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {step === 'form' && (
              <div className="space-y-4">
                {userType === 'clinica' ? (
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      Nome da clínica
                      <input value={form.clinicName} onChange={(event) => handleChange('clinicName', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="Clínica Vida & Saúde" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      CNPJ
                      <input value={form.cnpj} onChange={(event) => handleChange('cnpj', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="00.000.000/0000-00" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Quantidade de médicos
                      <select value={form.doctorsCount} onChange={(event) => handleChange('doctorsCount', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400">
                        {Array.from({ length: 9 }, (_, index) => index + 2).map((value) => (
                          <option key={value} value={String(value)}>{value} médicos</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      WhatsApp
                      <input value={form.whatsapp} onChange={(event) => handleChange('whatsapp', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="(99) 99999-9999" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Endereço comercial
                      <input value={form.address} onChange={(event) => handleChange('address', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="Rua das Flores, 123" />
                    </label>
                  </div>
                ) : userType === 'medico' ? (
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      Nome completo
                      <input value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="João Silva" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      CRM
                      <input value={form.crm} onChange={(event) => handleChange('crm', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="CRM 12345" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      WhatsApp
                      <input value={form.whatsapp} onChange={(event) => handleChange('whatsapp', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="(99) 99999-9999" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Endereço residencial
                      <input value={form.address} onChange={(event) => handleChange('address', event.target.value)} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="Av. Brasil, 456" />
                    </label>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">Selecione o tipo de conta acima para preencher os dados.</div>
                )}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <button type="button" onClick={() => setStep('type')} className="rounded-3xl border px-6 py-3 text-sm text-slate-700">Voltar</button>
                  <button type="button" onClick={handleSubmitForm} className="rounded-3xl bg-green-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!canSubmitForm}>
                    {isSendingCode ? 'Enviando código...' : 'Continuar'}
                  </button>
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {infoMessage && <p className="mt-3 text-sm text-green-700">{infoMessage}</p>}
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-4">
                <div className="grid gap-4">
                  <label className="space-y-2 text-sm text-slate-700">
                    Código de verificação
                    <input value={typedCode} onChange={(e) => setTypedCode(e.target.value)} maxLength={4} className="w-full rounded-3xl border border-green-200 bg-[#f7fff7] px-4 py-3 text-slate-900 outline-none focus:border-green-400" placeholder="1234" />
                  </label>
                  <p className="text-sm text-slate-500">Enviamos um código de 4 dígitos para seu e-mail.</p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <button type="button" onClick={() => setStep('form')} className="rounded-3xl border px-6 py-3 text-sm text-slate-700">Voltar</button>
                  <button
                    type="button"
                    onClick={handleConfirmCode}
                    className="rounded-3xl bg-green-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-3"
                    disabled={isSaving || isVerifyingCode}
                  >
                    {isVerifyingCode || isSaving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                          <path d="M4 12a8 8 0 018-8" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        {isVerifyingCode ? 'Verificando...' : 'Confirmando...'}
                      </>
                    ) : (
                      'Confirmar código'
                    )}
                  </button>
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex items-center gap-3 text-sm text-slate-600">
                  <Mail className="h-4 w-4 text-green-600" />
                  <div>
                    <p>Código válido por 5 minutos.</p>
                    <p className="text-xs text-slate-500">Tempo restante: <span className="font-medium">{countdown}</span></p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-xs">Ao confirmar, seus dados serão salvos com segurança.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
