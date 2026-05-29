'use client';

import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/backup', label: 'Backup' },
];
import Link from 'next/link';
import { useCustomSession } from '@/lib/useSession';

export default function Header() {
  const { data: session, status } = useCustomSession();
  const pathname = usePathname();
  const isAuthenticated = status === 'authenticated' && session?.user;
  const [mounted, setMounted] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setEmailVerified(false);
      return;
    }
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((data) => setEmailVerified(data.accessVerified === true))
      .catch(() => setEmailVerified(false));
  }, [isAuthenticated, status]);

  const handleLogout = async () => {
    const { signOut } = await import('next-auth/react');
    await signOut({ callbackUrl: '/login' });
  };

  if (!mounted) {
    return (
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 hover:opacity-80 transition">
          <div className="bg-[#90EE90] text-white p-3 rounded-xl">
            <span className="text-2xl">🩺</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MedSupAPP</h1>
            <p className="text-sm text-gray-500">Gestão para clínicas</p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
      <Link
        href={
          isAuthenticated && emailVerified
            ? '/dashboard'
            : isAuthenticated
              ? '/auth/verificar-email'
              : '/'
        }
        className="flex items-center gap-4 hover:opacity-80 transition"
      >
        <div className="bg-[#90EE90] text-white p-3 rounded-xl">
          <span className="text-2xl">🩺</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MedSupAPP</h1>
          <p className="text-sm text-gray-500">Gestão para clínicas</p>
        </div>
      </Link>

      {isAuthenticated ? (
        <div className="flex items-center gap-4 lg:gap-6">
          {emailVerified && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    pathname === link.href || pathname.startsWith(link.href + '/')
                      ? 'bg-green-50 text-[#228B22]'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          {!emailVerified && (
            <Link
              href="/auth/verificar-email"
              className="hidden md:inline-flex text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg"
            >
              Confirme seu e-mail para acessar o sistema
            </Link>
          )}
          {emailVerified && (
            <Link
              href="/dashboard/perfil"
              title="Meu perfil"
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 transition ${
                pathname === '/dashboard/perfil' ||
                pathname.startsWith('/dashboard/perfil/')
                  ? 'bg-green-50 ring-1 ring-[#90EE90]/60'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="text-right">
                <p className="font-medium text-gray-800">{session.user?.name}</p>
                <p className="text-xs text-gray-500">{session.user?.email}</p>
              </div>
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            </Link>
          )}
          {emailVerified === false && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-medium text-gray-800">{session.user?.name}</p>
                <p className="text-xs text-gray-500">{session.user?.email}</p>
              </div>
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 transition"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded-lg bg-[#013a01] px-4 py-2 text-sm font-medium text-white hover:bg-[#025201] transition"
        >
          Entrar com Google
        </Link>
      )}
    </header>
  );

}
