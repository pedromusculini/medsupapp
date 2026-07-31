'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import ConfiguracoesSubNav, { resolveConfiguracoesTab } from '@/components/ConfiguracoesSubNav';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type { MensagensWhatsappConfig, MensagemTipo } from '@/lib/mensagensWhatsapp';
import { renderMensagem } from '@/lib/mensagensWhatsapp';
import {
  ensureRequiredPlaceholders,
  lembreteAntecedenciaLabel,
  lembreteAntecedenciaQuando,
  MENSAGEM_TIPO_INFO,
  previewVarsFromProfile,
} from '@/lib/mensagemTemplate';
import { isEnderecoPerfilCompleto } from '@/lib/agendamento';
import MensagemTemplateEditor from '@/components/MensagemTemplateEditor';
import MensagemPreviewReadOnly from '@/components/MensagemPreviewReadOnly';
import {
  DEFAULT_LEMBRETES_SETTINGS,
  formatDiasInput,
  parseDiasInputString,
  type LembretesWhatsappSettings,
} from '@/lib/lembretesConfig';
import HorariosAgendaEditor from '@/components/HorariosAgendaEditor';
import AutocadastroLinkCard from '@/components/AutocadastroLinkCard';
import AjudaSuporteCard from '@/components/AjudaSuporteCard';
import {
  disponibilidadeFromDb,
  normalizeDisponibilidadeForSave,
  type DispSlotInput,
} from '@/lib/disponibilidadeSlots';

const DIAS = [
  { v: 1, l: 'Segunda' },
  { v: 2, l: 'Terça' },
  { v: 3, l: 'Quarta' },
  { v: 4, l: 'Quinta' },
  { v: 5, l: 'Sexta' },
  { v: 6, l: 'Sábado' },
  { v: 0, l: 'Domingo' },
];

const MSG_KEYS: { key: MensagemTipo; label: string }[] = [
  { key: 'convite_agendamento', label: 'Convite para agendar' },
  { key: 'lembrete_7_dias', label: 'Lembrete 7 dias antes' },
  { key: 'lembrete_1_dia', label: 'Lembrete 1 dia antes' },
  { key: 'confirmacao_apos_agendar', label: 'Confirmação após reserva' },
];

type MsgViewMode = 'editar' | 'ver';

export default function ComunicacaoClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = resolveConfiguracoesTab(pathname, searchParams.get('tab'));
  const contentTab = tab === 'pagamento' ? 'mensagens' : tab;
  const [config, setConfig] = useState<MensagensWhatsappConfig | null>(null);
  const [defaults, setDefaults] = useState<MensagensWhatsappConfig | null>(null);
  const [lembretesSettings, setLembretesSettings] = useState<LembretesWhatsappSettings>(
    DEFAULT_LEMBRETES_SETTINGS,
  );
  const [diasAntecedenciaInput, setDiasAntecedenciaInput] = useState('7');
  const [slugUrl, setSlugUrl] = useState<string | null>(null);
  const [slugNome, setSlugNome] = useState('');
  const [disp, setDisp] = useState<DispSlotInput[]>([]);
  const [userType, setUserType] = useState('medico');
  const [medicosNomes, setMedicosNomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [openMsg, setOpenMsg] = useState<MensagemTipo | null>('convite_agendamento');
  const [msgMode, setMsgMode] = useState<Record<MensagemTipo, MsgViewMode>>({
    convite_agendamento: 'editar',
    lembrete_7_dias: 'editar',
    lembrete_1_dia: 'editar',
    confirmacao_apos_agendar: 'editar',
  });

  const previewVars = useMemo(() => previewVarsFromProfile(profile), [profile]);
  const enderecoCompleto = profile ? isEnderecoPerfilCompleto(profile) : false;

  function previewSnippet(tipo: MensagemTipo, template: string): string {
    const tpl = ensureRequiredPlaceholders(template, tipo);
    const vars =
      tipo === 'lembrete_7_dias'
        ? {
            ...previewVars,
            dias: String(lembretesSettings.lembrete_antecedencia_dias),
          }
        : previewVars;
    return renderMensagem(tpl, vars, tipo);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes, dRes, pRes, medRes] = await Promise.all([
      fetch('/api/perfil/mensagens-whatsapp'),
      fetch('/api/agenda/slug'),
      fetch('/api/agenda/disponibilidade'),
      fetch('/api/perfil'),
      fetch('/api/perfil/medicos'),
    ]);
    const m = await mRes.json();
    const s = await sRes.json();
    const d = await dRes.json();
    const p = await pRes.json();
    const med = await medRes.json();
    const cfg = m.config as MensagensWhatsappConfig;
    const defs = m.defaults as MensagensWhatsappConfig;
    const normalized = { ...cfg };
    for (const { key } of MSG_KEYS) {
      normalized[key] = ensureRequiredPlaceholders(cfg[key], key);
    }
    setConfig(normalized);
    setDefaults(defs);
    const lem = (m.lembretesSettings as LembretesWhatsappSettings | undefined) ?? {
      ...DEFAULT_LEMBRETES_SETTINGS,
    };
    setLembretesSettings(lem);
    setDiasAntecedenciaInput(formatDiasInput(lem.lembrete_antecedencia_dias));
    setSlugUrl(s.url || null);
    setProfile(p.profile ?? null);
    setSlugNome(s.nome_exibicao || p.profile?.clinic_name || p.profile?.full_name || '');
    setUserType(p.profile?.user_type || 'medico');
    const medRows = medRes.ok ? (med.medicos ?? []) : [];
    setMedicosNomes(
      medRows.map((row: { nome: string }) => row.nome?.trim()).filter(Boolean),
    );
    setDisp(
      disponibilidadeFromDb(
        (d.disponibilidade || []).map((row: Record<string, unknown>) => ({
          medico_nome: row.medico_nome as string | null,
          dia_semana: row.dia_semana as number,
          hora_inicio: String(row.hora_inicio).slice(0, 5),
          hora_fim: String(row.hora_fim).slice(0, 5),
          duracao_minutos: (row.duracao_minutos as number) || 40,
        })),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salvarMensagens() {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    const lembretesPayload: LembretesWhatsappSettings = {
      ...lembretesSettings,
      lembrete_antecedencia_dias: parseDiasInputString(diasAntecedenciaInput),
    };
    const res = await fetch('/api/perfil/mensagens-whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, lembretesSettings: lembretesPayload }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (data.lembretesSettings) {
        setLembretesSettings(data.lembretesSettings);
        setDiasAntecedenciaInput(
          formatDiasInput(data.lembretesSettings.lembrete_antecedencia_dias),
        );
      }
      setMsg('Mensagens e lembretes salvos.');
    } else setMsg('Erro ao salvar.');
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
      body: JSON.stringify({ disponibilidade: normalizeDisponibilidadeForSave(disp) }),
    });
    setSaving(false);
    if (res.ok) setMsg('Horários salvos.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mensagens WhatsApp, horários de atendimento e link público para pacientes agendarem.
        </p>
      </div>

      <div data-tour="config-nav">
        <ConfiguracoesSubNav />
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-600 text-sm">{msg}</div>
      )}

      {contentTab === 'mensagens' && config && (
        <div className="space-y-6" data-tour="config-mensagens">
          <div className="rounded-xl border border-emerald-200/50 bg-emerald-50 px-4 py-3 text-sm text-gray-800">
            <p className="font-semibold text-emerald-600 mb-2">Como personalizar</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-700">
              <li>Abra uma mensagem abaixo</li>
              <li>
                Em <strong>Personalizar</strong>, edite só o texto (caixas brancas); nome, data e
                links são automáticos
              </li>
              <li>
                Use <strong>Ver mensagem final</strong> para conferir como o paciente verá no
                WhatsApp
              </li>
              <li>Salve todas as mensagens no final</li>
            </ol>
            <p className="text-xs text-gray-600 mt-2">
              Use <code className="text-[11px]">{'{{link_curto}}'}</code>,{' '}
              <code className="text-[11px]">{'{{link_maps_curto}}'}</code> e{' '}
              <code className="text-[11px]">{'{{link_calendario_curto}}'}</code> em vez dos
              links completos. No lembrete com antecedência: endereço + adicionar à agenda (sem
              Como chegar). No lembrete de 1 dia: endereço + Como chegar (sem adicionar à agenda).
              Restaurar padrão aplica o novo formato.
              {!enderecoCompleto && profile && (
                <span className="block mt-1 text-amber-700">
                  Complete o endereço no Perfil para exibir o link do Maps nas mensagens.
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Lembretes no Dashboard</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Define quando as consultas aparecem no card de lembretes WhatsApp (você envia
                manualmente pelo botão).
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesSettings.lembrete_antecedencia_ativo}
                onChange={(e) =>
                  setLembretesSettings((s) => ({
                    ...s,
                    lembrete_antecedencia_ativo: e.target.checked,
                  }))
                }
                className="mt-1 rounded border-gray-300 text-emerald-600"
              />
              <span className="text-sm text-gray-700">
                <strong>Lembrete com antecedência</strong> — mostrar consultas X dias antes da data
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3 pl-7">
              <label className="text-sm text-gray-600">
                Dias antes (0–99)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={!lembretesSettings.lembrete_antecedencia_ativo}
                  value={diasAntecedenciaInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDiasAntecedenciaInput(digits);
                    setLembretesSettings((s) => ({
                      ...s,
                      lembrete_antecedencia_dias: parseDiasInputString(digits),
                    }));
                  }}
                  className="ml-2 w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                />
              </label>
              <span className="text-xs text-gray-400">
                Ex.: 7 = uma semana antes; 0 = no dia da consulta (janela do card)
              </span>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesSettings.lembrete_1_dia_ativo}
                onChange={(e) =>
                  setLembretesSettings((s) => ({
                    ...s,
                    lembrete_1_dia_ativo: e.target.checked,
                  }))
                }
                className="mt-1 rounded border-gray-300 text-emerald-600"
              />
              <span className="text-sm text-gray-700">
                <strong>Lembrete 1 dia antes</strong> — consultas para amanhã
              </span>
            </label>
          </div>

          <div className="space-y-3">
            {MSG_KEYS.map(({ key, label }) => {
              const labelFinal =
                key === 'lembrete_7_dias'
                  ? lembreteAntecedenciaLabel(lembretesSettings.lembrete_antecedencia_dias)
                  : label;
              const isOpen = openMsg === key;
              const mode = msgMode[key];
              const info = MENSAGEM_TIPO_INFO[key];
              const quando =
                key === 'lembrete_7_dias'
                  ? lembreteAntecedenciaQuando(lembretesSettings.lembrete_antecedencia_dias)
                  : info.quando;
              const snippet = previewSnippet(key, config[key]);

              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenMsg(isOpen ? null : key)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/80 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{labelFinal}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{quando}</p>
                      {!isOpen && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2 bg-[#f8f9fa] rounded-lg px-2 py-1.5 border border-gray-100">
                          {snippet}
                        </p>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              setMsgMode((m) => ({ ...m, [key]: 'editar' }))
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                              mode === 'editar'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Personalizar
                          </button>
                          <button
                            type="button"
                            onClick={() => setMsgMode((m) => ({ ...m, [key]: 'ver' }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                              mode === 'ver'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver mensagem final
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            defaults &&
                            setConfig((c) =>
                              c
                                ? {
                                    ...c,
                                    [key]: ensureRequiredPlaceholders(
                                      defaults[key],
                                      key,
                                    ),
                                  }
                                : c,
                            )
                          }
                          className="text-xs text-emerald-600 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restaurar padrão
                        </button>
                      </div>

                      {mode === 'editar' ? (
                        <MensagemTemplateEditor
                          tipo={key}
                          value={config[key]}
                          onChange={(v) =>
                            setConfig((c) =>
                              c
                                ? {
                                    ...c,
                                    [key]: ensureRequiredPlaceholders(v, key),
                                  }
                                : c,
                            )
                          }
                          onVerCompleta={() =>
                            setMsgMode((m) => ({ ...m, [key]: 'ver' }))
                          }
                        />
                      ) : (
                        <MensagemPreviewReadOnly
                          tipo={key}
                          template={config[key]}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={salvarMensagens}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar todas as mensagens
          </button>
        </div>
      )}

      {contentTab === 'link' && (
        <div className="space-y-6" data-tour="config-links">
          <AutocadastroLinkCard variant="settings" />

          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-emerald-600" />
              Link de agendamento online
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
                  className="px-4 py-2 rounded-lg border border-emerald-600 text-emerald-600 text-sm font-medium flex items-center justify-center gap-1"
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
                className="w-full py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm"
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

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/40 text-sm text-gray-700">
            <MessageSquare className="w-5 h-5 text-emerald-600 inline mr-2" />
            Lembretes são enviados manualmente pelo{' '}
            <Link href="/dashboard" className="text-emerald-600 font-semibold">
              Dashboard
            </Link>
            , com um toque no WhatsApp (7 e 1 dia antes da consulta).
          </div>
        </div>
      )}

      {contentTab === 'horarios' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Horários de atendimento
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {userType === 'clinica'
                ? 'Configure horários por médico ou deixe em branco para valer para toda a clínica. Usado no agendamento online.'
                : 'Defina os dias e horários em que você atende. Usado no agendamento online.'}
            </p>
            {disp.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Nenhum horário cadastrado — pacientes não verão vagas no link público.
              </p>
            )}
            <HorariosAgendaEditor
              rows={disp}
              onChange={setDisp}
              userType={userType}
              medicos={medicosNomes}
              saving={saving}
              onSave={salvarDisp}
            />
          </section>
        </div>
      )}

      {contentTab === 'ajuda' && (
        <div data-tour="config-ajuda">
          <AjudaSuporteCard className="mt-0" />
        </div>
      )}
    </div>
  );
}
