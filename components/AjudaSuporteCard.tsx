'use client';

import { Bug, Map } from 'lucide-react';
import { useCustomSession } from '@/lib/useSession';
import { openBugReport } from '@/lib/support';
import { startProductTour } from '@/lib/productTour';

export default function AjudaSuporteCard() {
  const { data: session } = useCustomSession();

  return (
    <section className="mt-10 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-gray-900 flex items-center gap-2">
        <Map className="w-5 h-5 text-emerald-600" />
        Ajuda e suporte
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Tour guiado do sistema e canal para reportar problemas técnicos.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => {
            startProductTour(0);
            window.location.href = '/dashboard';
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          <Map className="w-4 h-4" />
          Ver tour novamente
        </button>
        <button
          type="button"
          onClick={() =>
            openBugReport({
              userEmail: session?.user?.email ?? undefined,
            })
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Bug className="w-4 h-4" />
          Reportar bug
        </button>
      </div>
    </section>
  );
}
