"use client";

import { useState } from "react";
import { Loader2, Lock, X } from "lucide-react";

type ProntuarioPinModalProps = {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  pinConfigured: boolean;
};

export default function ProntuarioPinModal({
  open,
  onClose,
  onUnlocked,
  pinConfigured,
}: ProntuarioPinModalProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prontuario-acesso/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN incorreto");
      setPin("");
      onUnlocked();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao verificar PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-50">
            <Lock className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Desbloquear prontuário</h3>
            <p className="text-sm text-gray-500">Acesso válido por 30 minutos neste navegador</p>
          </div>
        </div>

        {!pinConfigured ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Configure um PIN da clínica em{" "}
              <a href="/dashboard/perfil" className="text-emerald-700 font-medium underline">
                Meu Perfil → Segurança do prontuário
              </a>{" "}
              para proteger anotações clínicas.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm text-gray-700">
              PIN da clínica (4–6 dígitos)
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg tracking-widest"
                placeholder="••••"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Desbloquear
            </button>
            <p className="text-xs text-gray-500 text-center">
              Esqueceu o PIN? Redefina em{" "}
              <a href="/dashboard/perfil" className="text-emerald-700 underline">
                Meu Perfil
              </a>{" "}
              com o código de recuperação.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
