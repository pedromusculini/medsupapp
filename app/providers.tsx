'use client';

import { SessionProvider } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import ProductTourProvider from '@/components/ProductTourProvider';
import LegalReacceptModal from '@/components/LegalReacceptModal';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ProductTourProvider>
            <AppShell>{children}</AppShell>
          </ProductTourProvider>
          <CookieConsentBanner />
          <LegalReacceptModal />
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
