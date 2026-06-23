import type { ReactNode } from 'react';
import type { PortfolioPublicData } from '@/lib/portfolio';

type PortfolioPublicViewProps = {
  data: PortfolioPublicData;
};

function medicoSubtitle(m: PortfolioPublicData['medico']): string {
  const parts: string[] = [];
  if (m.crm) parts.push(`CRM ${m.crm}`);
  if (m.specialty) parts.push(m.specialty);
  return parts.join(' · ');
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-stone-200/70 pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-900/70 sm:text-left">
        {title}
      </h2>
      <div className="mt-5 text-[15px] sm:text-base leading-[1.75] text-stone-700 whitespace-pre-wrap text-center sm:text-left">
        {children}
      </div>
    </section>
  );
}

export default function PortfolioPublicView({ data }: PortfolioPublicViewProps) {
  const subtitle = medicoSubtitle(data.medico);
  const fotos = data.portfolio.fotos.sort((a, b) => a.slot - b.slot);
  const capa = fotos[0]?.url;
  const galeria = fotos.slice(1);
  const vazio =
    !data.portfolio.historia && !data.portfolio.competencias && fotos.length === 0;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="relative overflow-hidden">
        {capa ? (
          <div className="relative h-[38vh] min-h-[200px] max-h-[380px] w-full sm:h-[42vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capa}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-stone-900/25 via-stone-900/5 to-[#fafaf9]"
              aria-hidden
            />
          </div>
        ) : (
          <div
            className="h-28 w-full bg-gradient-to-b from-teal-950/90 to-teal-900/40 sm:h-36"
            aria-hidden
          />
        )}

        <div
          className={`mx-auto w-full max-w-2xl px-5 text-center ${
            capa ? 'relative z-10 -mt-14 sm:-mt-16' : 'relative z-10 -mt-10 pt-2'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-900/75">
            {data.owner.nome_exibicao}
          </p>
          <h1 className="mt-3 text-[1.65rem] font-semibold leading-tight tracking-tight text-stone-900 sm:text-[2.35rem]">
            {data.medico.nome}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600 sm:text-[15px]">{subtitle}</p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:py-14 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {vazio ? (
          <p className="py-16 text-center text-sm text-stone-500">Portfólio em construção.</p>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {data.portfolio.historia && (
              <Section title="Sobre">{data.portfolio.historia}</Section>
            )}

            {data.portfolio.competencias && (
              <Section title="Competências">{data.portfolio.competencias}</Section>
            )}

            {galeria.length > 0 && (
              <section className="border-t border-stone-200/70 pt-10">
                <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-900/70 sm:text-left">
                  Consultório
                </h2>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {galeria.map((f) => (
                    <figure
                      key={f.slot}
                      className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.04]"
                    >
                      <div className="aspect-[4/3] bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url}
                          alt={f.legenda?.trim() || ''}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      {f.legenda?.trim() && (
                        <figcaption className="px-4 py-3 text-center text-xs text-stone-500 sm:text-left">
                          {f.legenda}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200/80 py-8 text-center text-[11px] text-stone-400 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="tracking-wide">MedSupAPP · perfil profissional</p>
      </footer>
    </div>
  );
}
