'use client';

import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import {
  parseTemplate,
  serializeTemplate,
  PLACEHOLDER_LABELS,
  REQUIRED_BY_TIPO,
  type TemplatePart,
} from '@/lib/mensagemTemplate';

type Props = {
  tipo: MensagemTipo;
  value: string;
  onChange: (value: string) => void;
};

export default function MensagemTemplateEditor({ tipo, value, onChange }: Props) {
  const parts = useMemo(() => parseTemplate(value), [value]);
  const required = REQUIRED_BY_TIPO[tipo];

  function updatePart(index: number, text: string) {
    const next: TemplatePart[] = parts.map((p, i) =>
      i === index && p.type === 'text' ? { type: 'text', value: text } : p,
    );
    onChange(serializeTemplate(next));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#228B22]" />
        Os campos em verde são preenchidos automaticamente — edite apenas o texto ao redor.
      </p>
      <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-3 space-y-2 min-h-[120px]">
        {parts.map((part, index) =>
          part.type === 'token' ? (
            <span
              key={`t-${index}-${part.token}`}
              className="inline-flex items-center gap-1 mx-0.5 px-2.5 py-1 rounded-lg bg-[#013a01] text-white text-xs font-semibold select-none cursor-not-allowed align-middle"
              title={PLACEHOLDER_LABELS[part.token] ?? part.token}
            >
              <Lock className="w-3 h-3 opacity-80" />
              {PLACEHOLDER_LABELS[part.token] ?? part.token}
            </span>
          ) : (
            <textarea
              key={`x-${index}`}
              value={part.value}
              onChange={(e) => updatePart(index, e.target.value)}
              rows={Math.max(2, part.value.split('\n').length)}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed resize-y min-h-[2.5rem] focus:ring-2 focus:ring-[#90EE90] focus:border-[#228B22]"
              placeholder="Digite o texto da mensagem..."
            />
          ),
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        Obrigatórios neste modelo:{' '}
        {required.map((t) => PLACEHOLDER_LABELS[t] ?? t).join(' · ')}
      </p>
    </div>
  );
}
