'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MapPin,
  Save,
  ArrowLeft,
  Building2,
  Stethoscope,
  User,
  Phone,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Users,
  Pencil,
  MessageCircle,
  Calendar,
  Copy,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import PhoneInput, { phoneValueForInput } from '@/components/PhoneInput';
import { isValidPhone } from '@/lib/phone';
import { isMobileDevice, openWhatsAppUrl, preOpenExternalTab } from '@/lib/openExternalUrl';
import Link from 'next/link';
import HealthPlanSelector from '@/components/HealthPlanSelector';
import ComunicacaoLinkCard from '@/components/ComunicacaoLinkCard';
import AssinaturaChangeCard from '@/components/AssinaturaChangeCard';
import ProntuarioSegurancaCard from '@/components/ProntuarioSegurancaCard';
import PortfolioEditorModal from '@/components/PortfolioEditorModal';
import {
  doctorsCountFromPlan,
  isValidPlanId,
  maxMedicosCadastrados,
  resolveProfilePlanId,
  type PlanId,
} from '@/lib/subscriptionPlans';


// Interface do perfil vinda da API
interface Profile {
  id: string;
  email: string;
  user_type: 'medico' | 'clinica';
  plan: string;
  trial_started: boolean;
  onboarding_completed: boolean;
  full_name?: string;
  crm?: string;
  specialty?: string;
  clinic_name?: string;
  cnpj?: string;
  doctors_count?: number;
  whatsapp?: string;
  address?: string;
  health_plan?: string;
  cep?: string;
  street?: string;
  address_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// Interface do médico da clínica
interface ClinicaMedico {
  id: string;
  clinica_email: string;
  nome: string;
  crm?: string;
  specialty?: string;
  whatsapp?: string;
  email?: string;
  percentual_comissao?: number | null;
  agenda_google_status?: 'connected' | 'pending' | null;
  repassar_custo_profissional?: boolean;
  created_at: string;
  portfolio_ativo?: boolean;
  portfolio_url?: string | null;
}

const INVITE_AGENDA_API = '/api/perfil/medicos/invite-agenda';

function agendaStatusLabel(status: ClinicaMedico['agenda_google_status']): string {
  if (status === 'connected') return 'Conectada';
  if (status === 'pending') return 'Pendente';
  return '—';
}

function agendaStatusClass(status: ClinicaMedico['agenda_google_status']): string {
  if (status === 'connected') return 'text-emerald-700 bg-emerald-50';
  if (status === 'pending') return 'text-amber-700 bg-amber-50';
  return 'text-gray-400 bg-gray-50';
}

function medicoWhatsappValido(whatsapp?: string | null): boolean {
  return isValidPhone(whatsapp);
}

export default function PerfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchingCep, setSearchingCep] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPortfolioEditor, setShowPortfolioEditor] = useState(false);
  const [portfolioShareLoading, setPortfolioShareLoading] = useState(false);

  // Estados do formulário
  const [form, setForm] = useState({
    fullName: '',
    crm: '',
    specialty: '',
    clinicName: '',
    cnpj: '',
    whatsapp: '',
    healthPlan: '',
    cep: '',
    street: '',
    addressNumber: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Carregar perfil
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;

    fetch('/api/perfil')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          const p = data.profile;
          setForm({
            fullName: p.full_name || '',
            crm: p.crm || '',
            specialty: p.specialty || '',
            clinicName: p.clinic_name || '',
            cnpj: p.cnpj ? aplicarMascaraCNPJ(p.cnpj) : '',
            whatsapp: p.whatsapp ? phoneValueForInput(p.whatsapp) : '',
            healthPlan: p.health_plan || '',
            cep: p.cep || '',
            street: p.street || '',
            addressNumber: p.address_number || '',
            complement: p.complement || '',
            neighborhood: p.neighborhood || '',
            city: p.city || '',
            state: p.state || '',
            country: p.country || 'Brasil',
          });
        }
      })
      .catch((err) => console.error('[perfil] Erro ao carregar:', err))
      .finally(() => setLoading(false));
  }, [status, session]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  // Buscar CEP via ViaCEP
  const handleSearchCep = useCallback(async () => {
    const cepLimpo = form.cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return;
    }

    setSearchingCep(true);
    setError('');
    setSuccess('');

    try {
      // Tenta ViaCEP primeiro
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data: EnderecoViaCEP = await res.json();

      if (data.erro) {
        setError('CEP não encontrado');
        return;
      }

      setForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        country: 'Brasil',
      }));

      setSuccess('Endereço preenchido automaticamente!');
    } catch {
      setError('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setSearchingCep(false);
    }
  }, [form.cep]);

  // Máscaras
  function aplicarMascaraCNPJ(valor: string): string {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
    let mascara = apenasNumeros;
    if (apenasNumeros.length > 2) mascara = apenasNumeros.slice(0, 2) + '.' + apenasNumeros.slice(2);
    if (apenasNumeros.length > 5) mascara = mascara.slice(0, 6) + '.' + mascara.slice(6);
    if (apenasNumeros.length > 8) mascara = mascara.slice(0, 10) + '/' + mascara.slice(10);
    if (apenasNumeros.length > 12) mascara = mascara.slice(0, 15) + '-' + mascara.slice(15);
    return mascara;
  }

  const handleSave = async () => {
    if (!session?.user?.email) {
      setError('Usuário não autenticado');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body: Record<string, unknown> = {
        full_name: form.fullName,
        crm: form.crm,
        specialty: form.specialty,
        clinic_name: form.clinicName,
        cnpj: form.cnpj.replace(/\D/g, ''),
        whatsapp: form.whatsapp,
        health_plan: form.healthPlan,
        cep: form.cep.replace(/\D/g, ''),
        street: form.street,
        address_number: form.addressNumber,
        complement: form.complement,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
        country: form.country,
      };

      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const isMedico = profile?.user_type === 'medico';
  const planId = isValidPlanId(profile?.plan ?? '')
    ? (profile!.plan as PlanId)
    : resolveProfilePlanId(profile ?? {});
  const maxMedicosClinica = planId ? maxMedicosCadastrados(planId) : 5;
  const limitePlanoClinica = planId ? doctorsCountFromPlan(planId) : null;

  const reloadProfile = useCallback(() => {
    fetch('/api/perfil')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
      })
      .catch(() => {});
  }, []);

  const openPortfolioWhatsAppSolo = async () => {
    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setPortfolioShareLoading(true);
    setError('');
    try {
      const res = await fetch('/api/perfil/portfolio/whatsapp', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao compartilhar');
      if (data.whatsapp_url) {
        openWhatsAppUrl(data.whatsapp_url, {
          appUrl: data.whatsapp_app_url,
          androidUrl: data.whatsapp_android_url,
          preOpened,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao compartilhar portfólio');
    } finally {
      setPortfolioShareLoading(false);
    }
  };

  if (!mounted || status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8" data-tour="perfil-header">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500 mt-1">Gerencie suas informações profissionais e endereço</p>
        </div>
      </div>

      {/* Tipo de conta */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-200/20">
            {isMedico ? (
              <Stethoscope className="w-6 h-6 text-emerald-600" />
            ) : (
              <Building2 className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {isMedico ? 'Médico Solo' : 'Clínica'}
            </p>
            <p className="text-sm text-gray-500">
              Plano: {profile?.plan || 'Não definido'} • {session?.user?.email}
            </p>
          </div>
        </div>
      </div>

      <AssinaturaChangeCard onPlanChanged={reloadProfile} />

      <div className="mb-6">
        <ComunicacaoLinkCard />
      </div>

      <ProntuarioSegurancaCard />

      {/* Mensagens */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Formulário */}
      <div className="space-y-6">
        {/* Seção: Dados Profissionais */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-900">Dados Profissionais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMedico ? (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome completo
                  <input
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="Dr. João Silva"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  CRM
                  <input
                    value={form.crm}
                    onChange={(e) => handleChange('crm', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="CRM 12345"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  Especialidade
                  <input
                    value={form.specialty}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="Dermatologista"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome da clínica
                  <input
                    value={form.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="Clínica Vida & Saúde"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  CNPJ
                  <input
                    value={form.cnpj}
                    onChange={(e) => handleChange('cnpj', aplicarMascaraCNPJ(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="00.000.000/0000-00"
                  />
                </label>
                <p className="text-sm text-gray-600 md:col-span-2 bg-emerald-50 border border-emerald-200/40 rounded-xl px-4 py-3">
                  Plano atual: cadastre até{' '}
                  <strong>{maxMedicosClinica} médicos</strong> na seção &quot;Médicos da Clínica&quot;
                  abaixo
                  {limitePlanoClinica
                    ? ` (limite operacional do plano: ${limitePlanoClinica}).`
                    : '.'}{' '}
                  Para mudar o limite, altere o plano em Assinatura acima.
                </p>
              </>
            )}

            <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                WhatsApp
              </div>
              <PhoneInput
                value={form.whatsapp}
                onChange={(v) => handleChange('whatsapp', v)}
                inputClassName="rounded-xl border-gray-200 bg-white text-gray-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
              />
            </label>

            <div className="md:col-span-2">
              <HealthPlanSelector
                value={form.healthPlan}
                onChange={(v) => handleChange('healthPlan', v)}
                label={
                  profile?.user_type === 'clinica'
                    ? 'Convênios que a clínica aceita'
                    : 'Convênios que você atende'
                }
              />
            </div>
          </div>
        </div>

        {/* Seção: Endereço */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-900">Endereço</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Este endereço será usado na agenda para gerar links do Google Maps nos
            compromissos dos pacientes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CEP com busca automática */}
            <label className="space-y-1.5 text-sm text-gray-700">
              CEP
              <div className="flex gap-2">
                <input
                  value={form.cep}
                  onChange={(e) => handleChange('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onBlur={() => form.cep.replace(/\D/g, '').length === 8 && handleSearchCep()}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                  placeholder="00000-000"
                  maxLength={8}
                />
                <button
                  type="button"
                  onClick={handleSearchCep}
                  disabled={searchingCep || form.cep.replace(/\D/g, '').length !== 8}
                  className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
                  title="Buscar CEP"
                >
                  {searchingCep ? (
                    <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </label>

            <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
              Logradouro
              <input
                value={form.street}
                onChange={(e) => handleChange('street', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Rua das Flores"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Número
              <input
                value={form.addressNumber}
                onChange={(e) => handleChange('addressNumber', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="123"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Complemento
              <input
                value={form.complement}
                onChange={(e) => handleChange('complement', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Sala 101"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Bairro
              <input
                value={form.neighborhood}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Centro"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Cidade
              <input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="São Paulo"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Estado
              <select
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
              >
                <option value="">Selecione</option>
                {[
                  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
                ].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              País
              <input
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
              />
            </label>
          </div>
        </div>

        {/* Seção: Portfólio profissional (médico solo) */}
        {isMedico && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Portfólio profissional</h2>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Página pública opcional com sua história, competências e até 6 fotos do
                    consultório (WebP). Visível em{' '}
                    <code className="text-xs bg-gray-100 px-1 rounded">/pro/seu-slug/voce</code>{' '}
                    e no autoagendamento.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowPortfolioEditor(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
              >
                <Briefcase className="w-4 h-4" />
                Editar portfólio
              </button>
              <button
                type="button"
                onClick={() => void openPortfolioWhatsAppSolo()}
                disabled={portfolioShareLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#25D366] text-[#25D366] hover:bg-emerald-50 transition disabled:opacity-50"
              >
                {portfolioShareLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Seção: Médicos da Clínica (apenas para clínicas) */}
        {!isMedico && (
          <GestaoMedicos
            clinicaEmail={session?.user?.email || ''}
            maxMedicos={maxMedicosClinica}
          />
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {showPortfolioEditor && isMedico && (
        <PortfolioEditorModal
          medicoNome={form.fullName || 'Profissional'}
          onClose={() => setShowPortfolioEditor(false)}
        />
      )}
    </div>
  );
}

type MedicoFormState = {
  nome: string;
  crm: string;
  specialty: string;
  whatsapp: string;
  email: string;
  percentual_comissao: string;
  repassar_custo_profissional: boolean;
};

const MEDICO_FORM_VAZIO: MedicoFormState = {
  nome: '',
  crm: '',
  specialty: '',
  whatsapp: '',
  email: '',
  percentual_comissao: '50',
  repassar_custo_profissional: false,
};

function MedicoFormFields({
  value,
  onChange,
}: {
  value: MedicoFormState;
  onChange: (patch: Partial<MedicoFormState>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="space-y-1 text-sm text-gray-600 md:col-span-2">
        Nome *
        <input
          value={value.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 text-sm"
          placeholder="Dr. Carlos Pereira"
        />
      </label>
      <label className="space-y-1 text-sm text-gray-600">
        CRM
        <input
          value={value.crm}
          onChange={(e) => onChange({ crm: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 text-sm"
          placeholder="CRM 67890"
        />
      </label>
      <label className="space-y-1 text-sm text-gray-600">
        Especialidade
        <input
          value={value.specialty}
          onChange={(e) => onChange({ specialty: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 text-sm"
          placeholder="Cardiologista"
        />
      </label>
      <label className="space-y-1 text-sm text-gray-600 md:col-span-2">
        WhatsApp
        <PhoneInput
          value={value.whatsapp}
          onChange={(v) => onChange({ whatsapp: v })}
          showIcon={false}
          inputClassName="rounded-xl border-gray-200 bg-white py-2.5 text-sm"
        />
      </label>
      <label className="space-y-1 text-sm text-gray-600">
        E-mail
        <input
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 text-sm"
          placeholder="carlos@clinica.com"
        />
      </label>
      <label className="space-y-1 text-sm text-gray-600">
        Comissão padrão (%)
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value.percentual_comissao}
          onChange={(e) => onChange({ percentual_comissao: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 text-sm"
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-gray-600 md:col-span-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <input
          type="checkbox"
          checked={value.repassar_custo_profissional}
          onChange={(e) => onChange({ repassar_custo_profissional: e.target.checked })}
          className="mt-1 rounded border-gray-300 text-emerald-600"
        />
        <span>
          <strong>Repassar taxa do meio de pagamento</strong> — desconta PIX/cartão antes de
          calcular a comissão deste médico.
        </span>
      </label>
    </div>
  );
}

// ============================================================
// Componente de Gestão de Médicos (para clínicas)
// ============================================================
function GestaoMedicos({
  clinicaEmail,
  maxMedicos,
}: {
  clinicaEmail: string;
  maxMedicos: number;
}) {
  const [medicos, setMedicos] = useState<ClinicaMedico[]>([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingMedico, setSavingMedico] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [novoMedico, setNovoMedico] = useState<MedicoFormState>({ ...MEDICO_FORM_VAZIO });
  const [editMedico, setEditMedico] = useState<MedicoFormState>({ ...MEDICO_FORM_VAZIO });
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);
  const [prontuarioLoading, setProntuarioLoading] = useState<string | null>(null);
  const [copiadoProntuario, setCopiadoProntuario] = useState<string | null>(null);
  const [portfolioMedico, setPortfolioMedico] = useState<ClinicaMedico | null>(null);
  const [portfolioShareLoading, setPortfolioShareLoading] = useState<string | null>(null);
  const [portfolioCopyLoading, setPortfolioCopyLoading] = useState<string | null>(null);
  const [copiadoPortfolio, setCopiadoPortfolio] = useState<string | null>(null);

  function iniciarEdicao(medico: ClinicaMedico) {
    setShowAddForm(false);
    setEditingId(medico.id);
    setEditMedico({
      nome: medico.nome,
      crm: medico.crm ?? '',
      specialty: medico.specialty ?? '',
      whatsapp: medico.whatsapp ? phoneValueForInput(medico.whatsapp) : '',
      email: medico.email ?? '',
      percentual_comissao: String(medico.percentual_comissao ?? 50),
      repassar_custo_profissional: !!medico.repassar_custo_profissional,
    });
    setError('');
    setSuccess('');
  }

  function cancelarEdicao() {
    setEditingId(null);
    setEditMedico({ ...MEDICO_FORM_VAZIO });
  }

  // Carregar médicos
  const carregarMedicos = useCallback(async () => {
    try {
      const res = await fetch('/api/perfil/medicos');
      const data = await res.json();
      if (res.ok) {
        setMedicos(data.medicos || []);
      }
    } catch (err) {
      console.error('[GestaoMedicos] Erro ao carregar:', err);
    } finally {
      setLoadingMedicos(false);
    }
  }, []);

  useEffect(() => {
    carregarMedicos();
  }, [carregarMedicos]);

  // Adicionar médico
  const atLimit = medicos.length >= maxMedicos;

  const handleAdicionar = async () => {
    if (atLimit) {
      setError(`Limite do plano: até ${maxMedicos} médicos cadastrados na clínica.`);
      return;
    }
    if (!novoMedico.nome.trim()) {
      setError('Nome do médico é obrigatório');
      return;
    }

    setSavingMedico(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/perfil/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoMedico,
          percentual_comissao: Number(novoMedico.percentual_comissao) || 50,
          repassar_custo_profissional: novoMedico.repassar_custo_profissional,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao adicionar médico');
      }

      setSuccess(`Médico "${novoMedico.nome}" adicionado com sucesso!`);
      setNovoMedico({ ...MEDICO_FORM_VAZIO });
      setShowAddForm(false);
      carregarMedicos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar médico');
    } finally {
      setSavingMedico(false);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!editingId) return;
    if (!editMedico.nome.trim()) {
      setError('Nome do médico é obrigatório');
      return;
    }

    setSavingMedico(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/perfil/medicos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...editMedico,
          percentual_comissao: Number(editMedico.percentual_comissao) || 50,
          repassar_custo_profissional: editMedico.repassar_custo_profissional,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar médico');
      }

      setSuccess(`Médico "${editMedico.nome}" atualizado com sucesso!`);
      cancelarEdicao();
      carregarMedicos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar médico');
    } finally {
      setSavingMedico(false);
    }
  };

  const copiarProntuarioLink = async (medico: ClinicaMedico) => {
    setProntuarioLoading(medico.id);
    try {
      const res = await fetch('/api/perfil/medicos/prontuario-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: medico.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar link');
      await navigator.clipboard.writeText(data.prontuario_url);
      setCopiadoProntuario(medico.id);
      setTimeout(() => setCopiadoProntuario(null), 2500);
      if (data.deprecated) {
        setSuccess(
          `Convite de agenda de ${medico.nome} copiado. O prontuário abre pelo link no campo Local do Google Calendar.`,
        );
      } else {
        setSuccess(`Link de prontuário de ${medico.nome} copiado!`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao copiar link');
    } finally {
      setProntuarioLoading(null);
    }
  };

  const openInviteWhatsApp = async (medico: ClinicaMedico) => {
    if (!medicoWhatsappValido(medico.whatsapp)) return;

    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setInviteLoading(medico.id);
    setError('');
    try {
      const res = await fetch(INVITE_AGENDA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: medico.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar convite');

      if (data.whatsapp_url) {
        openWhatsAppUrl(data.whatsapp_url, {
          appUrl: data.whatsapp_app_url,
          androidUrl: data.whatsapp_android_url,
          preOpened,
        });
      }

      setMedicos((list) =>
        list.map((m) =>
          m.id === medico.id ? { ...m, agenda_google_status: 'pending' as const } : m,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar convite');
    } finally {
      setInviteLoading(null);
    }
  };

  const openPortfolioWhatsApp = async (medico: ClinicaMedico) => {
    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setPortfolioShareLoading(medico.id);
    setError('');
    try {
      const res = await fetch(`/api/perfil/medicos/${medico.id}/portfolio/whatsapp`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao compartilhar');
      if (data.whatsapp_url) {
        openWhatsAppUrl(data.whatsapp_url, {
          appUrl: data.whatsapp_app_url,
          androidUrl: data.whatsapp_android_url,
          preOpened,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao compartilhar portfólio');
    } finally {
      setPortfolioShareLoading(null);
    }
  };

  const copiarPortfolioLink = async (medico: ClinicaMedico) => {
    if (medico.portfolio_url) {
      try {
        await navigator.clipboard.writeText(medico.portfolio_url);
        setCopiadoPortfolio(medico.id);
        setTimeout(() => setCopiadoPortfolio(null), 2500);
        setSuccess(`Link do portfólio de ${medico.nome} copiado!`);
      } catch {
        setError('Não foi possível copiar o link');
      }
      return;
    }

    setPortfolioCopyLoading(medico.id);
    setError('');
    try {
      const res = await fetch(`/api/perfil/medicos/${medico.id}/portfolio`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar portfólio');
      const url = data.portfolio?.public_url as string | null;
      if (!url) {
        setError(
          `Ative e publique o portfólio de ${medico.nome} antes de copiar o link.`,
        );
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiadoPortfolio(medico.id);
      setTimeout(() => setCopiadoPortfolio(null), 2500);
      setMedicos((list) =>
        list.map((m) =>
          m.id === medico.id ? { ...m, portfolio_url: url, portfolio_ativo: true } : m,
        ),
      );
      setSuccess(`Link do portfólio de ${medico.nome} copiado!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao copiar link');
    } finally {
      setPortfolioCopyLoading(null);
    }
  };

  // Remover médico
  const handleRemover = async (id: string, nome: string) => {
    if (!confirm(`Remover médico "${nome}"? Esta ação não pode ser desfeita.`)) return;

    if (editingId === id) cancelarEdicao();
    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/perfil/medicos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao remover médico');
      }

      setSuccess(`Médico "${nome}" removido com sucesso!`);
      carregarMedicos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover médico');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Médicos da Clínica</h2>
            <p className="text-xs text-gray-500">
              {medicos.length} de {maxMedicos} cadastrados · envie convite WhatsApp para conectar agenda Google
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setNovoMedico({ ...MEDICO_FORM_VAZIO });
            } else {
              cancelarEdicao();
              setShowAddForm(true);
            }
          }}
          disabled={atLimit && !showAddForm}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Formulário de adicionar médico */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Novo Médico</p>
          <MedicoFormFields
            value={novoMedico}
            onChange={(patch) => setNovoMedico((p) => ({ ...p, ...patch }))}
          />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={savingMedico}
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {savingMedico ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {savingMedico ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNovoMedico({ ...MEDICO_FORM_VAZIO });
              }}
              className="px-6 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de médicos */}
      {loadingMedicos ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : medicos.length === 0 ? (
        <p className="text-gray-400 text-sm py-6 text-center">
          Nenhum médico cadastrado. Clique em "Adicionar" para incluir.
        </p>
      ) : (
        <div className="space-y-3">
          {medicos.map((medico) => (
            <div key={medico.id}>
              {editingId === medico.id ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Editar médico</p>
                  <MedicoFormFields
                    value={editMedico}
                    onChange={(patch) => setEditMedico((p) => ({ ...p, ...patch }))}
                  />
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={handleSalvarEdicao}
                      disabled={savingMedico}
                      className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingMedico ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {savingMedico ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    {medicoWhatsappValido(editMedico.whatsapp) &&
                      medico.agenda_google_status !== 'connected' && (
                        <button
                          type="button"
                          onClick={() =>
                            void openInviteWhatsApp({
                              ...medico,
                              whatsapp: editMedico.whatsapp,
                            })
                          }
                          disabled={inviteLoading === medico.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[#25D366] text-[#25D366] hover:bg-emerald-50 transition disabled:opacity-50"
                        >
                          {inviteLoading === medico.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                          Pedir agenda Google
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={cancelarEdicao}
                      disabled={savingMedico}
                      className="px-6 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                  {medico.agenda_google_status === 'connected' && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                      <Calendar className="w-3.5 h-3.5" />
                      Agenda Google conectada
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{medico.nome}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${agendaStatusClass(medico.agenda_google_status)}`}
                      >
                        {agendaStatusLabel(medico.agenda_google_status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      {medico.crm && <span>CRM: {medico.crm}</span>}
                      {medico.specialty && <span>{medico.specialty}</span>}
                      {medico.whatsapp && <span>{medico.whatsapp}</span>}
                      {medico.email && <span>{medico.email}</span>}
                      {medico.percentual_comissao != null && (
                        <span>Comissão: {medico.percentual_comissao}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPortfolioMedico(medico)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition [-webkit-tap-highlight-color:transparent]"
                    >
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      Editar portfólio
                    </button>
                    {medico.portfolio_url ? (
                      <>
                        <a
                          href={medico.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-teal-900 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-950 transition [-webkit-tap-highlight-color:transparent]"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          Ver portfólio
                        </a>
                        <button
                          type="button"
                          onClick={() => void copiarPortfolioLink(medico)}
                          disabled={portfolioCopyLoading === medico.id}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
                        >
                          {portfolioCopyLoading === medico.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : copiadoPortfolio === medico.id ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Copiar link
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void copiarPortfolioLink(medico)}
                        disabled={portfolioCopyLoading === medico.id}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-emerald-300 hover:text-emerald-800 transition disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
                      >
                        {portfolioCopyLoading === medico.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Obter link
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openPortfolioWhatsApp(medico)}
                      disabled={portfolioShareLoading === medico.id}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#25D366]/40 bg-white px-3 py-2 text-xs font-medium text-[#128C7E] hover:bg-emerald-50 transition disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
                    >
                      {portfolioShareLoading === medico.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5" />
                      )}
                      WhatsApp
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
                    <button
                      type="button"
                      onClick={() => void copiarProntuarioLink(medico)}
                      disabled={prontuarioLoading === medico.id}
                      className="p-2 rounded-lg hover:bg-white text-slate-500 hover:text-emerald-600 transition disabled:opacity-50"
                      title="Convite agenda / prontuário"
                    >
                      {prontuarioLoading === medico.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : copiadoProntuario === medico.id ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </button>
                    {medicoWhatsappValido(medico.whatsapp) &&
                      medico.agenda_google_status !== 'connected' && (
                        <button
                          type="button"
                          onClick={() => void openInviteWhatsApp(medico)}
                          disabled={inviteLoading === medico.id}
                          className="p-2 rounded-lg hover:bg-white text-[#25D366] hover:text-[#20bd5a] transition disabled:opacity-50"
                          title="Pedir acesso à agenda Google"
                        >
                          {inviteLoading === medico.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Calendar className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => iniciarEdicao(medico)}
                      className="p-2 rounded-lg hover:bg-white text-gray-400 hover:text-emerald-600 transition"
                      title="Editar médico"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemover(medico.id, medico.nome)}
                      disabled={deletingId === medico.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                      title="Remover médico"
                    >
                      {deletingId === medico.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {portfolioMedico && (
        <PortfolioEditorModal
          medicoId={portfolioMedico.id}
          medicoNome={portfolioMedico.nome}
          onClose={() => setPortfolioMedico(null)}
          onSaved={() => void carregarMedicos()}
        />
      )}
    </div>
  );
}
