'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AgendaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const t = setTimeout(() => window.location.replace('/login'), 0);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando agenda...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Agenda</h1>
      <p className="text-gray-600 mb-8">Gerencie suas consultas, lembretes WhatsApp e retornos</p>
      
      <div className="bg-white rounded-3xl shadow p-12 text-center">
        <p className="text-2xl text-gray-500">Agenda completa em desenvolvimento...</p>
        <p className="text-gray-400 mt-4">Em breve: Drag & drop + integração Google Calendar</p>
      </div>
    </div>
  );
}