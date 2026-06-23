/** Versões dos documentos legais — incremente ao publicar alterações materiais. */
export const PRIVACY_POLICY_VERSION = '2026-06-23';
export const TERMS_VERSION = '2026-06-19';

export const LEGAL_CONTACT = 'contato@medsupapp.com.br';
export const SUPPORT_EMAIL = 'suporte@medsupapp.com.br';
export const PRIVACY_CONTACT = 'privacidade@medsupapp.com.br';

export const COMPANY_LEGAL_NAME = 'MedSupAPP';
export const COMPANY_PRODUCT_NAME = 'MedSupAPP — Medical Super Application';

/** Foro preferencial nos Termos (ajuste com parecer jurídico se necessário). */
export const LEGAL_FORUM = 'comarca de São Paulo, Estado de São Paulo';

export function needsLegalReaccept(
  acceptedPrivacy: string | null | undefined,
  acceptedTerms: string | null | undefined,
): boolean {
  return acceptedPrivacy !== PRIVACY_POLICY_VERSION || acceptedTerms !== TERMS_VERSION;
}
