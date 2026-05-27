'use client';

import { useCustomSession } from '@/lib/useSession';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanceiroPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando...</div>;
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Financeiro</h1>
      <p className="text-gray-600">Em breve: Controle de entradas, saídas e repasses automáticos por %</p>
    </div>
  );
}
