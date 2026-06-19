'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  FileText,
  Loader2,
  MessageSquare,
  Save,
  User,
} from 'lucide-react';
import type { ProntuarioEntrada } from '@/lib/prontuarioEntradasDrive';

type FichaData = {
  nome_clinica: string;
  cliente_drive_id: string;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
    convenio: string | null;
    observacoes_gerais: string | null;
  };
  observacoes: Array<{ texto: string; autor: string | null; created_at: string }>;
  ultimos_atendimentos: Array<{
    data: string;
    hora: string | null;
    servico: string | null;
    medico: string | null;
    observacoes: string | null;
    status: string;
  }>;
  evolucoes: ProntuarioEntrada[];
};

function formatDataBr(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

type Props = { token: string };

export default function ClienteFichaProfissionalView({ token }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaData | null>(null);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  async function carregarFicha() {
    const res = await fetch(`/api/formulario/${encodeURIComponent(token)}/ficha`);
    if (res.status === 401) {
      const callbackUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return null;
    }
    const data = await res.json();
    if (res.status === 403) {
      setError(data.error ?? 'Você não tem permissão para ver esta ficha');
      return null;
    }
    if (data.error) {
      setError(data.error);
      return null;
    }
    setFicha(data as FichaData);
    return data as FichaData;
  }

  useEffect(() => {
    carregarFicha()
      .catch(() => setError('Não foi possível carregar a ficha'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function salvarEvolucao() {
    if (!texto.trim() || texto.trim().length < 2) {
      setErroSalvar('Digite a evolução do prontuário');
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    setSucesso(null);
    try {
      const res = await fetch(`/api/formulario/${encodeURIComponent(token)}/entrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setTexto('');
      setSucesso('Evolução registrada.');
      await carregarFicha();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-red-600">{error ?? 'Ficha indisponível'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 py-8 sm:p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-emerald-700 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wide opacity-80">{ficha.nome_clinica}</p>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2">
            <User className="w-5 h-5 shrink-0" />
            {ficha.cliente.nome}
          </h1>
          {(ficha.cliente.telefone || ficha.cliente.email || ficha.cliente.convenio) && (
            <p className="text-sm opacity-90 mt-1">
              {[ficha.cliente.telefone, ficha.cliente.email, ficha.cliente.convenio && `Plano: ${ficha.cliente.convenio}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-emerald-700" />
              Nova evolução
            </h2>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              placeholder="Evolução, conduta, prescrição..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            {erroSalvar && <p className="mt-2 text-sm text-red-600">{erroSalvar}</p>}
            {sucesso && <p className="mt-2 text-sm text-emerald-700">{sucesso}</p>}
            <button
              type="button"
              onClick={() => void salvarEvolucao()}
              disabled={salvando}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar evolução
            </button>
          </section>

          {ficha.evolucoes.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-emerald-700" />
                Evoluções recentes
              </h2>
              <ul className="space-y-2">
                {ficha.evolucoes.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-sm"
                  >
                    <p className="text-xs text-gray-500">
                      {formatDataBr(e.data)}
                      {e.hora ? ` · ${e.hora}` : ''}
                      {e.medico ? ` · ${e.medico}` : ''}
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap mt-1">{e.texto}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              Observações
            </h2>
            {ficha.observacoes.length > 0 ? (
              <ul className="space-y-2">
                {ficha.observacoes.slice(0, 6).map((obs, i) => (
                  <li
                    key={`${obs.created_at}-${i}`}
                    className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-sm"
                  >
                    <p className="text-gray-800 whitespace-pre-wrap">{obs.texto}</p>
                    {obs.autor && (
                      <p className="text-xs text-gray-400 mt-1">{obs.autor}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Sem observações cadastradas.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-emerald-700" />
              Últimos atendimentos
            </h2>
            {ficha.ultimos_atendimentos.length > 0 ? (
              <ul className="space-y-3">
                {ficha.ultimos_atendimentos.map((a, i) => (
                  <li
                    key={`${a.data}-${a.hora ?? ''}-${i}`}
                    className="border border-gray-100 rounded-xl p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="font-medium text-gray-900">
                        {formatDataBr(a.data)}
                        {a.hora ? ` · ${a.hora}` : ''}
                      </span>
                      {a.medico && <span className="text-xs text-gray-500">{a.medico}</span>}
                    </div>
                    {a.servico && (
                      <p className="text-gray-700 mt-1">
                        <span className="text-gray-500">Tipo: </span>
                        {a.servico}
                      </p>
                    )}
                    {a.observacoes && (
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">
                        {a.observacoes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Nenhum atendimento registrado ainda.</p>
            )}
          </section>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-6">
        MedSupAPP · Ficha do paciente (acesso profissional)
      </p>
    </div>
  );
}
