import ProntuarioLinkDescontinuado from '@/components/ProntuarioLinkDescontinuado';
import ProntuarioPortalLegado from '@/components/ProntuarioPortalLegado';
import { isProntuarioTokenEnabled } from '@/lib/prontuarioTokenFeature';

type Props = { params: Promise<{ token: string }> };

export default async function ProntuarioMedicoPage({ params }: Props) {
  const { token } = await params;

  if (!isProntuarioTokenEnabled()) {
    return <ProntuarioLinkDescontinuado token={token} />;
  }

  return <ProntuarioPortalLegado token={token} />;
}
