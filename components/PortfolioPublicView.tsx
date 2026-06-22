import type { PortfolioPublicData } from '@/lib/portfolio';
import { Stethoscope } from 'lucide-react';

type PortfolioPublicViewProps = {
  data: PortfolioPublicData;
};

function medicoSubtitle(m: PortfolioPublicData['medico']): string {
  const parts: string[] = [];
  if (m.crm) parts.push(`CRM ${m.crm}`);
  if (m.specialty) parts.push(m.specialty);
  return parts.join(' · ');
}

export default function PortfolioPublicView({ data }: PortfolioPublicViewProps) {
  const subtitle = medicoSubtitle(data.medico);
  const fotos = data.portfolio.fotos.sort((a, b) => a.slot - b.slot);
  const capa = fotos[0]?.url;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 to-white">
      <header className="bg-white border-b border-emerald-100/80">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {data.owner.nome_exibicao}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {data.medico.nome}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
              {subtitle}
            </p>
          )}
        </div>
      </header>

      {capa && (
        <div className="max-w-3xl mx-auto px-4 -mt-0">
          <div className="rounded-2xl overflow-hidden shadow-md border border-white/80 aspect-[16/9] sm:aspect-[2/1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capa} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {data.portfolio.historia && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sobre</h2>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.portfolio.historia}
            </div>
          </section>
        )}

        {data.portfolio.competencias && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Competências</h2>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.portfolio.competencias}
            </div>
          </section>
        )}

        {fotos.length > 1 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Consultório</h2>
            <div className="grid grid-cols-2 gap-3">
              {fotos.slice(1).map((f) => (
                <div
                  key={f.slot}
                  className="rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 border border-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {!data.portfolio.historia && !data.portfolio.competencias && fotos.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-12">
            Portfólio em construção.
          </p>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        MedSupAPP · perfil profissional
      </footer>
    </div>
  );
}
