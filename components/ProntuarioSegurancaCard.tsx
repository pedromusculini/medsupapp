'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  Users,
} from 'lucide-react';

type AccessStatus = {
  pinConfigured: boolean;
  unlocked: boolean;
  modoRecepcao: boolean;
  locked: boolean;
  unlockExpiresAt: string | null;
};

export default function ProntuarioSegurancaCard() {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recoveryCodeShown, setRecoveryCodeShown] = useState<string | null>(null);

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinAtual, setPinAtual] = useState('');
  const [showPins, setShowPins] = useState(false);

  const [resetMode, setResetMode] = useState<'none' | 'recovery' | 'email'>('none');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [newPinReset, setNewPinReset] = useState('');
  const [newPinResetConfirm, setNewPinResetConfirm] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/prontuario-acesso/status');
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  async function handleDefinirPin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSaving(true);
    try {
      const res = await fetch('/api/prontuario-acesso/definir-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          pinConfirm,
          pinAtual: status?.pinConfigured ? pinAtual : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar PIN');
      setPin('');
      setPinConfirm('');
      setPinAtual('');
      if (data.recoveryCode) {
        setRecoveryCodeShown(data.recoveryCode);
        setSuccess('PIN configurado. Copie o código de recuperação abaixo — ele não será exibido novamente.');
      } else {
        setSuccess(data.message || 'PIN atualizado.');
      }
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar PIN');
    } finally {
      setSaving(false);
    }
  }

  async function toggleModoRecepcao() {
    clearMessages();
    setSaving(true);
    try {
      const res = await fetch('/api/prontuario-acesso/modo-recepcao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status?.modoRecepcao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar modo recepção');
      setSuccess(data.message);
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function solicitarCodigoEmail() {
    clearMessages();
    setSendingEmail(true);
    try {
      const res = await fetch('/api/prontuario-acesso/recuperar-pin', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código');
      setSuccess(data.message);
      setResetMode('email');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar código');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleRecuperarPin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSaving(true);
    try {
      const res = await fetch('/api/prontuario-acesso/recuperar-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: newPinReset,
          pinConfirm: newPinResetConfirm,
          recoveryCode: resetMode === 'recovery' ? recoveryInput : undefined,
          emailOtp: resetMode === 'email' ? emailOtp : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir PIN');
      setRecoveryInput('');
      setEmailOtp('');
      setNewPinReset('');
      setNewPinResetConfirm('');
      setResetMode('none');
      if (data.recoveryCode) {
        setRecoveryCodeShown(data.recoveryCode);
      }
      setSuccess(data.message || 'PIN redefinido.');
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir PIN');
    } finally {
      setSaving(false);
    }
  }

  function copyRecoveryCode() {
    if (!recoveryCodeShown) return;
    void navigator.clipboard.writeText(recoveryCodeShown);
    setSuccess('Código copiado para a área de transferência.');
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex items-center gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        Carregando segurança do prontuário...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-slate-100">
          <Shield className="w-6 h-6 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Segurança do prontuário</h2>
          <p className="text-sm text-gray-500 mt-1">
            PIN da clínica para proteger anotações clínicas. Modo recepção oculta o prontuário na
            recepção.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {recoveryCodeShown && (
        <div className="mb-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Código de recuperação (guarde em local seguro — exibido uma única vez)
          </p>
          <p className="font-mono text-xl tracking-widest text-center py-2 text-amber-950">
            {recoveryCodeShown}
          </p>
          <button
            type="button"
            onClick={copyRecoveryCode}
            className="mt-2 w-full py-2 rounded-lg bg-amber-200/80 text-amber-900 text-sm font-medium"
          >
            Copiar código
          </button>
          <p className="text-xs text-amber-800 mt-2">
            Use este código para redefinir o PIN se esquecer. A secretária não deve ter acesso a
            ele.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
            status?.pinConfigured
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          {status?.pinConfigured ? 'PIN configurado' : 'PIN não configurado'}
        </span>
        {status?.pinConfigured && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
              status.unlocked ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {status.unlocked ? 'Prontuário desbloqueado' : 'Prontuário bloqueado'}
          </span>
        )}
        {status?.modoRecepcao && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800">
            <Users className="w-3.5 h-3.5" />
            Modo recepção ativo
          </span>
        )}
      </div>

      <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900 text-sm">Modo recepção</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Oculta a aba Prontuário e filtra dados clínicos nas APIs — ideal com a secretária na
              frente do computador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleModoRecepcao()}
            disabled={saving}
            className={`relative w-12 h-7 rounded-full transition ${
              status?.modoRecepcao ? 'bg-amber-500' : 'bg-gray-300'
            } disabled:opacity-50`}
            aria-pressed={status?.modoRecepcao}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition ${
                status?.modoRecepcao ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleDefinirPin} className="space-y-3 mb-6">
        <p className="text-sm font-medium text-gray-800">
          {status?.pinConfigured ? 'Alterar PIN' : 'Definir PIN da clínica'}
        </p>
        {status?.pinConfigured && (
          <label className="block text-sm text-gray-600">
            PIN atual
            <div className="relative mt-1">
              <input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                value={pinAtual}
                onChange={(e) => setPinAtual(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10"
              />
            </div>
          </label>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm text-gray-600">
            {status?.pinConfigured ? 'Novo PIN' : 'PIN'} (4–6 dígitos)
            <input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5"
            />
          </label>
          <label className="block text-sm text-gray-600">
            Confirmar PIN
            <input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPins((v) => !v)}
            className="text-xs text-gray-500 flex items-center gap-1"
          >
            {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPins ? 'Ocultar' : 'Mostrar'} PIN
          </button>
          <button
            type="submit"
            disabled={saving || pin.length < 4 || pin !== pinConfirm}
            className="ml-auto bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {status?.pinConfigured ? 'Alterar PIN' : 'Salvar PIN'}
          </button>
        </div>
      </form>

      {status?.pinConfigured && (
        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-medium text-gray-800 mb-2">Esqueci o PIN</p>
          <p className="text-xs text-gray-500 mb-3">
            Preferencial: código de recuperação (8 caracteres) gerado na configuração do PIN.
            Alternativa: código por e-mail —{' '}
            <strong>não use se a secretária compartilha o e-mail da clínica</strong>. Recomendamos
            login Google com e-mail pessoal do médico titular.
          </p>

          {resetMode === 'none' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setResetMode('recovery')}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Tenho o código de recuperação
              </button>
              <button
                type="button"
                onClick={() => void solicitarCodigoEmail()}
                disabled={sendingEmail}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {sendingEmail ? 'Enviando...' : 'Enviar código por e-mail'}
              </button>
            </div>
          )}

          {resetMode !== 'none' && (
            <form onSubmit={handleRecuperarPin} className="space-y-3 mt-3 p-4 bg-gray-50 rounded-xl">
              {resetMode === 'recovery' && (
                <label className="block text-sm text-gray-600">
                  Código de recuperação
                  <input
                    value={recoveryInput}
                    onChange={(e) =>
                      setRecoveryInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono tracking-widest uppercase"
                    placeholder="ABCD2345"
                  />
                </label>
              )}
              {resetMode === 'email' && (
                <label className="block text-sm text-gray-600">
                  Código do e-mail (6 dígitos)
                  <input
                    inputMode="numeric"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5"
                  />
                </label>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm text-gray-600">
                  Novo PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    value={newPinReset}
                    onChange={(e) => setNewPinReset(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Confirmar novo PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    value={newPinResetConfirm}
                    onChange={(e) =>
                      setNewPinResetConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetMode('none')}
                  className="px-4 py-2 rounded-xl text-sm border border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    newPinReset.length < 4 ||
                    newPinReset !== newPinResetConfirm ||
                    (resetMode === 'recovery' && recoveryInput.length < 8) ||
                    (resetMode === 'email' && emailOtp.length < 6)
                  }
                  className="px-4 py-2 rounded-xl text-sm bg-emerald-700 text-white disabled:opacity-50"
                >
                  Redefinir PIN
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
