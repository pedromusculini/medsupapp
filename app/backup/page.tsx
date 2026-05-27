'use client';

import { useCustomSession } from '@/lib/useSession';

export default function BackupPage() {
  const { data: session, status } = useCustomSession();

  if (status === 'loading') {
    return <div className="p-8">Carregando...</div>;
  }

  if (status === 'unauthenticated' || !session) {
    return <div className="p-8">Redirecionando...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Backup e Exportação</h1>
      <p className="text-gray-600">Em breve: Exportar CSV + Backup automático no Google Drive</p>
    </div>
  );
}
