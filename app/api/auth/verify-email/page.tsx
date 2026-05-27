'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (!email) {
      const storedEmail = localStorage.getItem('pendingVerificationEmail');
      if (storedEmail) setEmail(storedEmail);
    }
  }, [email]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');
    if (value && index < 3) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 4) {
      setError('Por favor, digite os 4 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('E-mail verificado com sucesso! Redirecionando...');
        localStorage.removeItem('pendingVerificationEmail');
        setTimeout(() => router.push('/onboarding'), 1500);
      } else {
        setError(data.error || 'Código inválido ou expirado');
      }
    } catch {
      setError('Erro ao verificar o código');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSuccess('Código reenviado com sucesso!');
        setTimeLeft(60);
        setCode(['', '', '', '']);
      } else {
        setError('Erro ao reenviar o código');
      }
    } catch {
      setError('Erro ao reenviar');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
          <p className="text-gray-600 mb-4">E-mail não informado.</p>
          <a href="/register" className="text-green-600 hover:underline font-medium">
            Voltar ao cadastro
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        {/* Ícone de e-mail */}
        <div className="mx-auto mb-4 w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-center mb-4">Verifique seu e-mail</h1>
        <p className="text-center text-gray-600 mb-8">
          Enviamos um código de 4 dígitos para<br />
          <strong className="text-green-700">{email}</strong>
        </p>

        <div className="flex gap-4 justify-center mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              className="w-16 h-16 text-center text-4xl font-semibold border-2 border-gray-300 rounded-lg focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-3"
        >
          {loading && <Loader2 className="animate-spin w-5 h-5" />}
          Verificar Código
        </button>

        <button
          onClick={handleResend}
          disabled={timeLeft > 0 || resendLoading}
          className="w-full py-3 text-sm text-green-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          {resendLoading ? 'Reenviando...' : timeLeft > 0 ? `Reenviar em ${timeLeft}s` : 'Reenviar código'}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full mt-2 py-3 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}