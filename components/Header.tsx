'use client';

import { useSession, signOut } from 'next-auth/react';
import { LogOut, User, Home } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
      <Link href="/dashboard" className="flex items-center gap-4 hover:opacity-80 transition">
        <div className="bg-[#90EE90] text-white p-3 rounded-xl">
          <span className="text-2xl">🩺</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MedSupAPP</h1>
          <p className="text-sm text-gray-500">Gestão para clínicas</p>
        </div>
      </Link>

      {session && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium text-gray-800">{session.user?.name}</p>
              <p className="text-xs text-gray-500">{session.user?.email}</p>
            </div>
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 transition"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      )}
    </header>
  );
}