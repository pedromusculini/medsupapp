'use client';

import './globals.css';
import { SessionProvider } from 'next-auth/react';
import Header from '@/components/Header';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <SessionProvider>
          <Header />
          <main className="min-h-[calc(100vh-85px)]">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}