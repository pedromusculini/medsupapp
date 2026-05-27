'use client';

import { useCustomSession } from '@/lib/useSession';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (status === 'unauthenticated' || !session) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <p className="text-gray-600 mb-4">Bem-vindo, {session.user?.name}!</p>
      <Link href="/onboarding" className="text-green-600 hover:underline">
        Ir para onboarding
      </Link>
    </div>
  );
}
