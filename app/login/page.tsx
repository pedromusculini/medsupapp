'use client';

import { signIn } from 'next-auth/react';
import { Stethoscope, Building2 } from 'lucide-react';

export default function LoginPage() {
  const handleLogin = (type: 'medico' | 'clinica') => {
    signIn('google', {
      callbackUrl: `/auth/choose-plan?role=${type}`,
      redirect: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900">MedSupAPP</h1>
          <p className="text-gray-600 mt-3 text-lg">Gestão simples para clínicas</p>
        </div>

        <h2 className="text-2xl font-semibold text-center mb-8">Entrar como Médico ou Clínica</h2>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin('medico')}
            className="w-full flex items-center gap-5 border-2 border-[#90EE90] hover:bg-[#f0f9f0] p-6 rounded-2xl transition-all"
          >
            <Stethoscope className="w-10 h-10 text-[#228B22]" />
            <div className="text-left">
              <div className="font-semibold text-xl">Médico Solo</div>
              <p className="text-sm text-gray-500">Entrar com Google</p>
            </div>
          </button>

          <button
            onClick={() => handleLogin('clinica')}
            className="w-full flex items-center gap-5 border-2 border-[#90EE90] hover:bg-[#f0f9f0] p-6 rounded-2xl transition-all"
          >
            <Building2 className="w-10 h-10 text-[#228B22]" />
            <div className="text-left">
              <div className="font-semibold text-xl">Clínica</div>
              <p className="text-sm text-gray-500">Entrar com Google</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}