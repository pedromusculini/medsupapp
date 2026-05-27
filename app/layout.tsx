'use client';

import './globals.css';
import Header from '@/components/Header';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <Header />
        <main className="min-h-[calc(100vh-85px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
