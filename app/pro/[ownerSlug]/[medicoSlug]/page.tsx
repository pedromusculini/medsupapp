import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadPublicPortfolio } from '@/lib/portfolio';
import PortfolioPublicView from '@/components/PortfolioPublicView';

type PageProps = {
  params: Promise<{ ownerSlug: string; medicoSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ownerSlug, medicoSlug } = await params;
  const data = await loadPublicPortfolio(ownerSlug, medicoSlug);
  if (!data) {
    return { title: 'Portfólio não encontrado' };
  }
  const title = `${data.medico.nome} — ${data.owner.nome_exibicao}`;
  const description =
    data.portfolio.historia?.slice(0, 160) ||
    `Conheça ${data.medico.nome}, ${data.medico.specialty || 'profissional de saúde'}.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function PortfolioPublicPage({ params }: PageProps) {
  const { ownerSlug, medicoSlug } = await params;
  const data = await loadPublicPortfolio(ownerSlug, medicoSlug);
  if (!data) notFound();
  return <PortfolioPublicView data={data} />;
}
