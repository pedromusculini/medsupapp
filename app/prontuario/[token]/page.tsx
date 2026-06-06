'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Loader2, Save, Search, Stethoscope } from 'lucide-react';
import Link from 'next/link';

type PortalInfo = {
  nomeMedico: string;
  nomeClinica: string;
  specialty?: string | null;
  crm?: string | null;
};

type PacienteOpcao = {
  nome: string;
  telefone_normalizado: string;
  cliente_drive_id: string | null;
  convenio?: string | null;
};

type Entrada = {
  id: string;
  texto: string;
  autor_nome: string;
  paciente_nome: string;
  created_at: string;
};

export default function ProntuarioMedicoPage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState('');
  const [pacientes, setPacientes] = useState<PacienteOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [sel, setSel] = useState<PacienteOpcao | null>(null);

  const [texto, setTexto] = useState('');
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarEntradas = useCallback(
    async (clienteDriveId?: string | null) => {
      const qs = clienteDriveId
        ? `?cliente_drive_id=${encodeURIComponent(clienteDriveId)}`
        : '';
      const res = await fetch(`/api/prontuario/${encodeURIComponent(token)}/entrada${qs}`);
      const data = await res.json();
      if (res.ok) setEntradas(data.entradas ?? []);
    },
    [token],
  );

  useEffect(() => {
    fetch(`/api/prontuario/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setInfo(data);
      })
      .catch(() => setLoadError('Não foi possível carregar o portal'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!sel?.cliente_drive_id) return;
    void carregarEntradas(sel.cliente_drive_id);
  }, [sel, carregarEntradas]);

  useEffect(() => {
    if (busca.trim().length < 2) {
      setPacientes([]);
      return;
    }
    const t = setTimeout(() => {
      setBuscando(true);
      fetch(
        `/api/prontuario/${encodeURIComponent(token)}/pacientes?q=${encodeURIComponent(busca.trim())}`,
      )
        .then((r) => r.json())
        .then((d) => setPacientes(d.pacientes ?? []))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [busca, token]);

  async function salvar() {
    if (!sel) {
      setErro('Selecione um paciente');
      return;
    }
    if (texto.trim().length < 3) {
      setErro('Digite o registro do prontuário');
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const res = await fetch(`/api/prontuario/${encodeURIComponent(token)}/entrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_nome: sel.nome,
          cliente_drive_id: sel.cliente_drive_id,
          telefone: sel.telefone_normalizado,
          texto: texto.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      setTexto('');
      setSucesso('Prontuário salvo com sucesso.');
      await carregarEntradas(sel.cliente_drive_id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-700">{loadError || 'Link inválido'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-600/10 p-3">
            <Stethoscope className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              MedSupAPP · Prontuário
            </p>
            <h1 className="text-xl font-semibold text-slate-900">{info.nomeMedico}</h1>
            <p className="text-sm text-slate-600">{info.nomeClinica}</p>
            {(info.crm || info.specialty) && (
              <p className="text-xs text-slate-500 mt-1">
                {[info.crm && `CRM ${info.crm}`, info.specialty].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Search className="h-4 w-4" />
            Buscar paciente
          </h2>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou telefone (mín. 2 caracteres)"
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          {buscando && (
            <p className="mt-2 text-xs text-slate-500">Buscando...</p>
          )}
          {pacientes.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
              {pacientes.map((p) => (
                <li key={`${p.nome}-${p.telefone_normalizado}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSel(p);
                      setSucesso(null);
                      setErro(null);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                      sel?.nome === p.nome && sel?.telefone_normalizado === p.telefone_normalizado
                        ? 'bg-emerald-50'
                        : ''
                    }`}
                  >
                    <span className="font-medium text-slate-900">{p.nome}</span>
                    <span className="block text-xs text-slate-500">{p.telefone_normalizado}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sel && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText className="h-4 w-4" />
              Novo registro — {sel.nome}
            </h2>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              placeholder="Evolução, anamnese, conduta, prescrição..."
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="mt-2 text-sm text-emerald-700">{sucesso}</p>}
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar prontuário
            </button>
          </section>
        )}

        {sel && entradas.length > 0 && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Registros anteriores</h3>
            <ul className="mt-3 space-y-3">
              {entradas.map((e) => (
                <li key={e.id} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleString('pt-BR')} · {e.autor_nome}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-slate-800">{e.texto}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            medsupapp.com.br
          </Link>
        </p>
      </div>
    </div>
  );
}
