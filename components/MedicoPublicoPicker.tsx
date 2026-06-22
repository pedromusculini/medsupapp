'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { MedicoPublico } from '@/lib/medicosPublicos';
import { medicoPublicoSubtitle } from '@/lib/medicosPublicos';
import { ExternalLink } from 'lucide-react';

type MedicoPublicoPickerProps = {
  medicos: MedicoPublico[];
  isClinica?: boolean;
  value: string;
  onChange: (nome: string) => void;
  error?: string;
  title?: string;
  hint?: string;
  emptyMessage?: string;
};

export default function MedicoPublicoPicker({
  medicos,
  isClinica = false,
  value,
  onChange,
  error,
  title = 'Médico',
  hint,
  emptyMessage,
}: MedicoPublicoPickerProps) {
  useEffect(() => {
    if (medicos.length === 1 && value !== medicos[0].nome) {
      onChange(medicos[0].nome);
    }
  }, [medicos, value, onChange]);

  if (medicos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">
          {emptyMessage ||
            (isClinica
              ? 'Nenhum médico com agenda conectada'
              : 'Agenda não conectada')}
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Entre em contato com a clínica para agendar por WhatsApp.
        </p>
      </div>
    );
  }

  const escolha = medicos.length > 1;

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
          {escolha ? ' *' : ''}
        </h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        {!hint && escolha && (
          <p className="text-xs text-gray-500 mt-0.5">Escolha com quem deseja consultar</p>
        )}
      </div>
      <div className="space-y-2">
        {medicos.map((m) => {
          const subtitle = medicoPublicoSubtitle(m);
          const selected = value === m.nome;
          return (
            <button
              key={m.nome}
              type="button"
              onClick={() => escolha && onChange(m.nome)}
              disabled={!escolha}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-50'
                  : escolha
                    ? 'border-gray-100 hover:border-emerald-200'
                    : 'border-gray-100 bg-gray-50'
              } ${!escolha ? 'cursor-default' : ''}`}
            >
              <span className="font-medium text-gray-900 block">{m.nome}</span>
              {subtitle ? (
                <span className="text-xs text-gray-600 mt-0.5 block">{subtitle}</span>
              ) : (
                <span className="text-xs text-gray-400 mt-0.5 block">Agenda Google conectada</span>
              )}
              {m.portfolio_url && (
                <Link
                  href={m.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver perfil
                </Link>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
