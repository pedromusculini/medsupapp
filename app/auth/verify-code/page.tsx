'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Loader2 } from 'lucide-react';

function VerifyCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const role = searchParams.get('role') || 'medico';
  const plan = searchParams.get('plan') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [message, setMessage] = useState('Aguardando código...');
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCooldown(60);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 4) {
      setError('Digite os 4 dígitos do código.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Código inválido');
      }

      router.push(`/onboarding?role=${role}&plan=${plan}&trialStarted=true`);
    } catch (err: any) {
      setError(err.message || 'Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setMessage('Reenviando código...');
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, plan }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao reenviar código');
      }
      
      setMessage('Código reenviado! Verifique seu e-mail.');
      startCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <Mail className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Verifique seu e-mail</h1>
          <p className="text-gray-500 mt-2">
            Enviamos um código de 4 dígitos para<br />
            <strong className="text-gray-900">{email}</strong>
          </p>
          {message && (
            <p className="text-sm text-gray-400 mt-2">{message}</p>
          )}
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="w-full text-center text-4xl font-bold tracking-[0.5em] rounded-xl border-2 border-gray-300 px-4 py-4 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
            autoFocus
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 4}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {loading ? 'Verificando...' : 'Verificar código'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={handleResend}
            disabled={cooldown > 0}
            className="text-sm text-green-600 hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    }>
      <VerifyCodeContent />
    </Suspense>
  );
}