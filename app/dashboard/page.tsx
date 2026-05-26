'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  // FORÇA o onboarding no primeiro login
  const router = useRouter();

  useEffect(() => {
    if (session) {
      const t = setTimeout(() => window.location.replace('/onboarding'), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [session, router]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const t = setTimeout(() => window.location.replace('/login'), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, router]);

  if (status === 'loading' || !session) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;

  return <div>Redirecionando...</div>;
}