'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'register' | 'verify' | 'success';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || name.trim().length < 2) { setError('Nome deve ter pelo menos 2 caracteres.'); return; }
    if (!email.includes('@')) { setError('E-mail inválido.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error [register]:', errorText);
        let msg = 'Erro ao registrar';
        try { msg = JSON.parse(errorText).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const result = await res.json();
      startCooldown(60);
      setStep('verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 4) { setError('Digite os 4 dígitos do código.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-registration-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error [verify-registration-code]:', errorText);
        let msg = 'Código inválido';
        try { msg = JSON.parse(errorText).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const result = await res.json();
      
      // Salvar token de sessão
      if (result.sessionToken) {
        localStorage.setItem('session_token', result.sessionToken);
        document.cookie = `session_token=${result.sessionToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
      
      // Redirect to onboarding with trial start info
      const queryParams = new URLSearchParams();
      if (result.role) queryParams.set('role', result.role);
      if (result.plan) queryParams.set('plan', result.plan);
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
      const res = await fetch('/api/auth/resend-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error [resend-verification-code]:', errorText);
        let msg = 'Erro ao reenviar';
        try { msg = JSON.parse(errorText).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const result = await res.json();
      startCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar código');
    }
  };

  if (step === 'register') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-8">Criar conta</h1>
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Nome completo</label>
              <input
                id="name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mail</label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha</label>
              <input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Criando conta...' : 'Continuar'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <a href="/login" className="font-medium text-[#10b981] hover:underline">Entrar aqui</a>
          </p>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
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
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit" disabled={loading || code.length !== 4}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>
          <div className="text-center mt-4">
            <button
              type="button" onClick={handleResend} disabled={cooldown > 0}
              className="text-sm text-[#10b981] hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Conta verificada!</h1>
        <p className="text-gray-600 mb-8">
          Seu e-mail foi verificado com sucesso. Vamos configurar seu perfil.
        </p>
        {/* This success step is now skipped, direct redirect happens in handleVerify */}
        {/* If for some reason it's still needed, the button should reflect the new query params */}
        {/* <button
          onClick={() => router.push('/onboarding?trialStarted=true')}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Continuar para onboarding
        </button> */}
      </div>
    </div>
  );
}