'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailFromUrl = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(emailFromUrl);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Try to get email from localStorage as fallback
    if (!email) {
      const storedEmail = localStorage.getItem('pendingVerificationEmail');
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [email]);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
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
    if (code.length !== 4) { setError('Digite os 4 dígitos do código.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", errorText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Código inválido');
      // Redirecionar para onboarding após verificação bem-sucedida
      localStorage.removeItem('pendingVerificationEmail');
      const queryParams = new URLSearchParams();
      if (data.role) queryParams.set('role', data.role);
      if (data.plan) queryParams.set('plan', data.plan);
      queryParams.set('trialStarted', 'true');
      router.push(`/onboarding?${queryParams.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", errorText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erro ao reenviar');
      startCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar código');
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
          <p className="text-gray-600 mb-4">E-mail não informado.</p>
          <a href="/register" className="text-[#10b981] hover:underline font-medium">
            Voltar ao cadastro
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <h1 className="text-4xl font-bold text-gray-900 text-center mb-4">Verifique seu e-mail</h1>
        <p className="text-center text-gray-600 mb-8">
          Enviamos um código de 4 dígitos para{' '}
          <strong className="text-gray-900">{email}</strong>.
          <br />
          Verifique sua caixa de entrada (e spam).
        </p>
        <form onSubmit={handleVerify} className="space-y-5">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="w-full text-center text-4xl font-bold tracking-[0.5em] rounded-lg border border-gray-300 px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 4}
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Verificar código'}
          </button>
        </form>
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="text-sm text-[#10b981] hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
