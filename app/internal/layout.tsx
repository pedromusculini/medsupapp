import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operações — Admin',
  robots: { index: false, follow: false },
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="internal-ops-theme min-h-screen bg-zinc-950 text-zinc-100 selection:bg-red-900/50">
      {children}
    </div>
  );
}
