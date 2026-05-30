'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  Copy,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type { MensagensWhatsappConfig } from '@/lib/mensagensWhatsapp';
import { ensureRequiredPlaceholders } from '@/lib/mensagemTemplate';
import MensagemTemplateEditor from '@/components/MensagemTemplateEditor';

const DIAS = [
  { v: 1, l: 'Segunda' },
  { v: 2, l: 'Terça' },
  { v: 3, l: 'Quarta' },
  { v: 4, l: 'Quinta' },
  { v: 5, l: 'Sexta' },
  { v: 6, l: 'Sábado' },
  { v: 0, l: 'Domingo' },
];

type DispRow = {
  medico_nome: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
};

const MSG_KEYS: { key: keyof MensagensWhatsappConfig; label: string }[] = [
  { key: 'convite_agendamento', label: 'Convite para agendar' },
  { key: 'lembrete_7_dias', label: 'Lembrete 7 dias antes' },
  { key: 'lembrete_1_dia', label: 'Lembrete 1 dia antes' },
  { key: 'confirmacao_apos_agendar', label: 'Confirmação após reserva' },
];

export default function ComunicacaoClient() {
  const [tab, setTab] = useState<'mensagens' | 'agenda'>('mensagens');
  const [config, setConfig] = useState<MensagensWhatsappConfig | null>(null);
  const [defaults, setDefaults] = useState<MensagensWhatsappConfig | null>(null);
  const [slugUrl, setSlugUrl] = useState<string | null>(null);
  const [slugNome, setSlugNome] = useState('');
  const [disp, setDisp] = useState<DispRow[]>([]);
  const [medicos, setMedicos] = useState<string[]>([]);
  const [userType, setUserType] = useState<string>('medico');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes, dRes, pRes] = await Promise.all([
      fetch('/api/perfil/mensagens-whatsapp'),
      fetch('/api/agenda/slug'),
      fetch('/api/agenda/disponibilidade'),
      fetch('/api/perfil'),
    ]);
    const m = await mRes.json();
    const s = await sRes.json();
    const d = await dRes.json();
    const p = await pRes.json();
    const cfg = m.config as MensagensWhatsappConfig;
    const defs = m.defaults as MensagensWhatsappConfig;
    const normalized = { ...cfg };
    for (const { key } of MSG_KEYS) {
      normalized[key] = ensureRequiredPlaceholders(cfg[key], key);
    }
    setConfig(normalized);
    setDefaults(defs);
    setSlugUrl(s.url || null);
    setSlugNome(s.nome_exibicao || p.profile?.clinic_name || p.profile?.full_name || '');
    setDisp(
      (d.disponibilidade || []).map((row: Record<string, unknown>) => ({
        medico_nome: row.medico_nome as string | null,
        dia_semana: row.dia_semana as number,
        hora_inicio: String(row.hora_inicio).slice(0, 5),
        hora_fim: String(row.hora_fim).slice(0, 5),
        duracao_minutos: (row.duracao_minutos as number) || 40,
      })),
    );
    setUserType(p.profile?.user_type || 'medico');
    if (p.profile?.user_type === 'clinica') {
      const medRes = await fetch('/api/perfil/medicos');
      const med = await medRes.json();
      setMedicos((med.medicos || []).map((x: { nome: string }) => x.nome));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salvarMensagens() {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/perfil/mensagens-whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    if (res.ok) setMsg('Mensagens salvas.');
    else setMsg('Erro ao salvar.');
  }

  async function gerarSlug() {
    setSaving(true);
    const res = await fetch('/api/agenda/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_exibicao: slugNome }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      setSlugUrl(d.url);
      setMsg('Link de agendamento ativo.');
    }
  }

  async function salvarDisp() {
    setSaving(true);
    const res = await fetch('/api/agenda/disponibilidade', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disponibilidade: disp }),
    });
    setSaving(false);
    if (res.ok) setMsg('Horários salvos.');
  }

  function addDisp() {
    setDisp((prev) => [
      ...prev,
      {
        medico_nome: medicos[0] || null,
        dia_semana: 1,
        hora_inicio: '08:00',
        hora_fim: '12:00',
        duracao_minutos: 40,
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comunicação</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mensagens WhatsApp (wa.me), link público de agendamento e horários disponíveis.
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
        {(['mensagens', 'agenda'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-[#228B22] shadow-sm' : 'text-gray-600'
            }`}
          >
            {t === 'mensagens' ? 'Mensagens' : 'Agendamento online'}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-[#f4fff4] text-[#228B22] text-sm">{msg}</div>
      )}

      {tab === 'mensagens' && config && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            {MSG_KEYS.map(({ key, label }) => (
              <div key={key} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-0 border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-800">{label}</label>
                  <button
                    type="button"
                    onClick={() =>
                      defaults &&
                      setConfig((c) =>
                        c
                          ? {
                              ...c,
                              [key]: ensureRequiredPlaceholders(defaults[key], key),
                            }
                          : c,
                      )
                    }
                    className="text-xs text-[#228B22] flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar padrão
                  </button>
                </div>
                <MensagemTemplateEditor
                  tipo={key}
                  value={config[key]}
                  onChange={(v) =>
                    setConfig((c) =>
                      c ? { ...c, [key]: ensureRequiredPlaceholders(v, key) } : c,
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={salvarMensagens}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar mensagens
            </button>
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-[#228B22]" />
              Link público
            </h2>
            <input
              type="text"
              value={slugNome}
              onChange={(e) => setSlugNome(e.target.value)}
              placeholder="Nome exibido para pacientes"
              className="w-full mb-3 px-4 py-3 rounded-xl border border-gray-200 text-sm"
            />
            {slugUrl ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={slugUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#f8f9fa] text-sm border border-gray-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(slugUrl);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  }}
                  className="px-4 py-2 rounded-lg border border-[#228B22] text-[#228B22] text-sm font-medium flex items-center justify-center gap-1"
                >
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={gerarSlug}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm"
              >
                Gerar link de agendamento
              </button>
            )}
            {slugUrl && (
              <button
                type="button"
                onClick={gerarSlug}
                className="mt-2 text-xs text-gray-500 underline"
              >
                Atualizar nome / regenerar
              </button>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#228B22]" />
                Horários disponíveis
              </h2>
              <button
                type="button"
                onClick={addDisp}
                className="text-sm text-[#228B22] font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            {disp.length === 0 && (
              <p className="text-sm text-gray-500 mb-4">
                Defina quando pacientes podem marcar (ex.: seg–sex, 8h–12h).
              </p>
            )}
            <ul className="space-y-3">
              {disp.map((row, i) => (
                <li
                  key={i}
                  className="p-3 rounded-xl border border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {userType === 'clinica' && medicos.length > 0 && (
                    <select
                      value={row.medico_nome || ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setDisp((d) => {
                          const n = [...d];
                          n[i] = { ...n[i], medico_nome: v };
                          return n;
                        });
                      }}
                      className="col-span-2 sm:col-span-1 text-xs rounded-lg border px-2 py-2"
                    >
                      <option value="">Todos</option>
                      {medicos.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={row.dia_semana}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], dia_semana: v };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  >
                    {DIAS.map((d) => (
                      <option key={d.v} value={d.v}>
                        {d.l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.hora_inicio}
                    onChange={(e) => {
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], hora_inicio: e.target.value };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  />
                  <input
                    type="time"
                    value={row.hora_fim}
                    onChange={(e) => {
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], hora_fim: e.target.value };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setDisp((d) => d.filter((_, j) => j !== i))}
                    className="text-red-500 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={saving}
              onClick={salvarDisp}
              className="mt-4 w-full sm:w-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm"
            >
              <Save className="w-4 h-4" /> Salvar horários
            </button>
          </section>

          <div className="p-4 rounded-xl bg-[#f4fff4] border border-[#90EE90]/40 text-sm text-gray-700">
            <MessageSquare className="w-5 h-5 text-[#228B22] inline mr-2" />
            Lembretes são enviados manualmente pelo{' '}
            <Link href="/dashboard" className="text-[#228B22] font-semibold">
              Dashboard
            </Link>
            , com um toque no WhatsApp.
          </div>
        </div>
      )}
    </div>
  );
}
