'use client';

import { SessionProvider } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import ProductTourProvider from '@/components/ProductTourProvider';
import LegalReacceptModal from '@/components/LegalReacceptModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProductTourProvider>
        <AppShell>{children}</AppShell>
      </ProductTourProvider>
      <CookieConsentBanner />
      <LegalReacceptModal />
    </SessionProvider>
  );
}
