import { Suspense } from 'react';
import ComunicacaoClient from '@/components/ComunicacaoClient';

function ConfiguracoesLoading() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<ConfiguracoesLoading />}>
      <ComunicacaoClient />
    </Suspense>
  );
}
