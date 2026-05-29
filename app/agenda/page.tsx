'use client';

import { useCustomSession } from '@/lib/useSession';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AgendaPageClient from '@/components/AgendaPageClient';

export default function AgendaPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando agenda...</div>;
  }

  return (
    <AgendaPageClient
      userEmail={session.user?.email ?? ''}
      provider={null}
    />
  );
}
