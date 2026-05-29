'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import AppFooter from '@/components/AppFooter';

const MINIMAL_CHROME_PREFIXES = ['/auth/verificar-email', '/login'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const minimalChrome = MINIMAL_CHROME_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (minimalChrome) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-85px)]">{children}</main>
      <AppFooter />
    </>
  );
}
