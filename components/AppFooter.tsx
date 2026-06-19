import Link from 'next/link';
import { Bug } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { openBugReport } from '@/lib/support';

export default function AppFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center text-sm text-gray-600 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} MedSupAPP · Medical Super Application
        </p>
        <div className="flex flex-col gap-1 sm:items-end">
          <p>
            <Link href="/privacidade" className="hover:text-emerald-800 hover:underline">
              Privacidade
            </Link>
            {' · '}
            <Link href="/termos" className="hover:text-emerald-800 hover:underline">
              Termos
            </Link>
            {' · '}
            <Link href="/privacidade#cookies" className="hover:text-emerald-800 hover:underline">
              Cookies
            </Link>
          </p>
          <p className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => openBugReport()}
              className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
            >
              <Bug className="w-3.5 h-3.5" />
              Reportar bug
            </button>
            <span className="text-gray-300">·</span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="hover:text-emerald-800 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
