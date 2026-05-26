'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function BackupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const t = setTimeout(() => window.location.replace('/login'), 0);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Backup e Exportação</h1>
      <p className="text-gray-600">Em breve: Exportar CSV + Backup automático no Google Drive</p>
    </div>
  );
}