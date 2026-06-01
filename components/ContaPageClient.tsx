'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';

type ContaResponse = {
  subscription: {
    status: string;
    canUseApp: boolean;
    plano: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    daysLeftTrial: number | null;
  };
  profile: {
    plan_name: string;
    plan_value: number | null;
    user_type: string;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function statusLabel(status: string): string {
  if (status === 'trial') return 'Período de teste';
  if (status === 'active') return 'Assinatura ativa';
  return 'Assinatura inativa';
}

export default function ContaPageClient() {
  const searchParams = useSearchParams();
  const expiredRedirect = searchParams.get('expired') === '1';
  const [data, setData] = useState<ContaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/conta')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-red-600">
        <p>{error || 'Não foi possível carregar'}</p>
        <Link href="/login" className="text-[#228B22] underline mt-4 inline-block">
          Voltar ao login
        </Link>
      </div>
    );
  }

  const { subscription: sub, profile } = data;
  const isExpired = sub.status === 'expired' || !sub.canUseApp;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={sub.canUseApp ? '/dashboard' : '/backup'}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-[#90EE90]/20">
          <CreditCard className="w-6 h-6 text-[#228B22]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
          <p className="text-gray-500 text-sm">Plano e pagamento MedSupAPP</p>
        </div>
      </div>

      {expiredRedirect && isExpired && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-sm text-amber-900">
            O acesso operacional está bloqueado. Seus dados no Google Drive{' '}
            <strong>não foram apagados</strong>. Regularize o pagamento ou exporte um backup abaixo.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Plano</span>
          <span className="font-semibold">{profile.plan_name}</span>
        </div>
        {profile.plan_value != null && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Valor mensal</span>
            <span>R$ {profile.plan_value.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Status</span>
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              isExpired ? 'text-red-700' : 'text-[#228B22]'
            }`}
          >
            {isExpired ? (
              <AlertTriangle className="w-4 h-4" />
            ) : sub.status === 'trial' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {statusLabel(sub.status)}
          </span>
        </div>
        {sub.status === 'trial' && sub.daysLeftTrial != null && (
          <p className="text-sm text-gray-600">
            Teste gratuito: <strong>{sub.daysLeftTrial} dia(s)</strong> restante(s) (até{' '}
            {formatDate(sub.trial_ends_at)}). No dia 30 será necessário cadastrar o pagamento no
            Asaas.
          </p>
        )}
        {sub.status === 'active' && (
          <p className="text-sm text-gray-600">
            Período pago até <strong>{formatDate(sub.current_period_end)}</strong>.
          </p>
        )}
      </div>

      {isExpired && (
        <div className="space-y-4 mb-6">
          <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
            <h2 className="font-semibold text-red-900 mb-2">Pagamento necessário</h2>
            <p className="text-sm text-red-800 mb-4">
              Após o vencimento não há tolerância: o app libera de novo somente quando o Asaas
              confirmar o pagamento (webhook). Use o link de cobrança enviado por e-mail/WhatsApp
              pelo Asaas ou acesse o painel do provedor de pagamento.
            </p>
            <p className="text-xs text-red-700">
              Em breve: botão direto para checkout Asaas nesta tela.
            </p>
          </div>

          <Link
            href="/backup"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-[#228B22] text-[#228B22] font-semibold hover:bg-[#f4fff4] transition"
          >
            <Download className="w-5 h-5" />
            Exportar backup (CSV)
          </Link>
        </div>
      )}

      {!isExpired && (
        <p className="text-sm text-gray-500">
          Alteração de plano em{' '}
          <Link href="/dashboard/perfil" className="text-[#228B22] font-medium hover:underline">
            Meu perfil
          </Link>
          . Cobrança recorrente será gerenciada pelo Asaas quando o trial encerrar.
        </p>
      )}
    </div>
  );
}
