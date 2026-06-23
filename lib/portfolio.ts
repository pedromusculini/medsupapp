import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAppBaseUrl } from '@/lib/mensagensWhatsapp';
import { getOwnerBySlug, getSlugByOwner } from '@/lib/agendamento';

export const PORTFOLIO_BUCKET = 'portfolio-fotos';
export const MAX_PORTFOLIO_FOTOS = 6;

export type PortfolioFoto = {
  slot: number;
  path: string;
  legenda?: string | null;
};

export type PortfolioRow = {
  id: string;
  owner_email: string;
  clinica_medicos_id: string | null;
  medico_slug: string;
  historia: string | null;
  competencias: string | null;
  fotos: PortfolioFoto[];
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PortfolioPublicFoto = {
  slot: number;
  url: string;
  legenda?: string | null;
};

export type PortfolioPublicData = {
  owner: {
    slug: string;
    nome_exibicao: string;
  };
  medico: {
    nome: string;
    crm: string | null;
    specialty: string | null;
  };
  portfolio: {
    historia: string | null;
    competencias: string | null;
    fotos: PortfolioPublicFoto[];
  };
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function generateMedicoSlug(nome: string): string {
  const base = slugify(nome) || 'profissional';
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`.slice(0, 60);
}

export function getPortfolioPublicPath(ownerSlug: string, medicoSlug: string): string {
  return `/pro/${ownerSlug.toLowerCase().trim()}/${medicoSlug.toLowerCase().trim()}`;
}

export function getPortfolioPublicUrl(ownerSlug: string, medicoSlug: string): string {
  return `${getAppBaseUrl()}${getPortfolioPublicPath(ownerSlug, medicoSlug)}`;
}

export function getPortfolioFotoPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${path}`;
}

function parseFotos(raw: unknown): PortfolioFoto[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioFoto[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    const slot = Number(row.slot);
    const path = typeof row.path === 'string' ? row.path : '';
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PORTFOLIO_FOTOS || !path) {
      continue;
    }
    out.push({
      slot,
      path,
      legenda: typeof row.legenda === 'string' ? row.legenda : null,
    });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

function mapRow(data: Record<string, unknown>): PortfolioRow {
  return {
    id: String(data.id),
    owner_email: String(data.owner_email),
    clinica_medicos_id: data.clinica_medicos_id ? String(data.clinica_medicos_id) : null,
    medico_slug: String(data.medico_slug),
    historia: typeof data.historia === 'string' ? data.historia : null,
    competencias: typeof data.competencias === 'string' ? data.competencias : null,
    fotos: parseFotos(data.fotos),
    ativo: !!data.ativo,
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : undefined,
  };
}

async function uniqueMedicoSlug(ownerEmail: string, nome: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generateMedicoSlug(nome);
    const { data } = await supabaseAdmin
      .from('profissional_portfolio')
      .select('id')
      .eq('owner_email', ownerEmail)
      .eq('medico_slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${generateMedicoSlug(nome)}-${Date.now().toString(36)}`.slice(0, 60);
}

export async function resolveOwnerSlug(ownerEmail: string): Promise<string | null> {
  const row = await getSlugByOwner(ownerEmail);
  return row?.slug?.trim() || null;
}

export async function ensurePortfolioRecord(params: {
  ownerEmail: string;
  clinicaMedicosId?: string | null;
  nome: string;
}): Promise<PortfolioRow> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const medicoId = params.clinicaMedicosId ?? null;

  let query = supabaseAdmin.from('profissional_portfolio').select('*').eq('owner_email', owner);
  if (medicoId) {
    query = query.eq('clinica_medicos_id', medicoId);
  } else {
    query = query.is('clinica_medicos_id', null);
  }

  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;
  if (existing) return mapRow(existing as Record<string, unknown>);

  const medico_slug = await uniqueMedicoSlug(owner, params.nome);
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('profissional_portfolio')
    .insert({
      owner_email: owner,
      clinica_medicos_id: medicoId,
      medico_slug,
      fotos: [],
      ativo: false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (insErr) throw insErr;
  return mapRow(inserted as Record<string, unknown>);
}

export async function getPortfolioByMedicoId(
  ownerEmail: string,
  medicoId: string,
): Promise<PortfolioRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('*')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('clinica_medicos_id', medicoId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function getPortfolioTitular(ownerEmail: string): Promise<PortfolioRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('*')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .is('clinica_medicos_id', null)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function getPortfolioById(
  ownerEmail: string,
  portfolioId: string,
): Promise<PortfolioRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('*')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('id', portfolioId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function savePortfolioData(
  portfolioId: string,
  ownerEmail: string,
  patch: {
    historia?: string | null;
    competencias?: string | null;
    ativo?: boolean;
  },
): Promise<PortfolioRow> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ('historia' in patch) update.historia = patch.historia?.trim() || null;
  if ('competencias' in patch) update.competencias = patch.competencias?.trim() || null;
  if ('ativo' in patch) update.ativo = !!patch.ativo;

  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .update(update)
    .eq('id', portfolioId)
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updatePortfolioFotos(
  portfolioId: string,
  ownerEmail: string,
  fotos: PortfolioFoto[],
): Promise<PortfolioRow> {
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .update({
      fotos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', portfolioId)
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export type PortfolioLinkMap = Map<string, { medico_slug: string; public_url: string | null }>;

export type PortfolioMeta = {
  medico_slug: string;
  ativo: boolean;
  public_url: string | null;
};

/** Mapa clinica_medicos_id → metadados do portfólio (inclui inativos para a UI admin). */
export async function loadPortfolioMetaMap(
  ownerEmail: string,
): Promise<Map<string, PortfolioMeta>> {
  const owner = ownerEmail.toLowerCase().trim();
  const ownerSlug = await resolveOwnerSlug(owner);
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('clinica_medicos_id, medico_slug, ativo')
    .eq('owner_email', owner);

  if (error) throw error;

  const map = new Map<string, PortfolioMeta>();
  for (const row of data ?? []) {
    if (!row.medico_slug || !row.clinica_medicos_id) continue;
    const slug = String(row.medico_slug);
    const ativo = !!row.ativo;
    map.set(String(row.clinica_medicos_id), {
      medico_slug: slug,
      ativo,
      public_url:
        ativo && ownerSlug ? getPortfolioPublicUrl(ownerSlug, slug) : null,
    });
  }
  return map;
}

/** Mapa clinica_medicos_id (ou chave `titular`) → slug/url pública quando ativo. */
export async function loadActivePortfolioLinks(
  ownerEmail: string,
): Promise<PortfolioLinkMap> {
  const owner = ownerEmail.toLowerCase().trim();
  const ownerSlug = await resolveOwnerSlug(owner);
  const { data, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('clinica_medicos_id, medico_slug, ativo')
    .eq('owner_email', owner)
    .eq('ativo', true);

  if (error) throw error;

  const map: PortfolioLinkMap = new Map();
  for (const row of data ?? []) {
    if (!row.ativo || !row.medico_slug) continue;
    const key = row.clinica_medicos_id ? String(row.clinica_medicos_id) : 'titular';
    map.set(key, {
      medico_slug: String(row.medico_slug),
      public_url: ownerSlug
        ? getPortfolioPublicUrl(ownerSlug, String(row.medico_slug))
        : null,
    });
  }
  return map;
}

export async function loadPublicPortfolio(
  ownerSlug: string,
  medicoSlug: string,
): Promise<PortfolioPublicData | null> {
  const slugRow = await getOwnerBySlug(ownerSlug);
  if (!slugRow) return null;

  const ownerEmail = String(slugRow.owner_email).toLowerCase().trim();
  const { data: portfolio, error } = await supabaseAdmin
    .from('profissional_portfolio')
    .select('*')
    .eq('owner_email', ownerEmail)
    .eq('medico_slug', medicoSlug.toLowerCase().trim())
    .eq('ativo', true)
    .maybeSingle();

  if (error) throw error;
  if (!portfolio) return null;

  const row = mapRow(portfolio as Record<string, unknown>);
  let medicoNome = '';
  let crm: string | null = null;
  let specialty: string | null = null;

  if (row.clinica_medicos_id) {
    const { data: medico } = await supabaseAdmin
      .from('clinica_medicos')
      .select('nome, crm, specialty')
      .eq('id', row.clinica_medicos_id)
      .eq('clinica_email', ownerEmail)
      .maybeSingle();
    medicoNome = medico?.nome?.trim() || '';
    crm = medico?.crm?.trim() || null;
    specialty = medico?.specialty?.trim() || null;
  } else {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('full_name, crm, specialty')
      .eq('email', ownerEmail)
      .maybeSingle();
    medicoNome = profile?.full_name?.trim() || slugRow.nome_exibicao?.trim() || '';
    crm = profile?.crm?.trim() || null;
    specialty = profile?.specialty?.trim() || null;
  }

  return {
    owner: {
      slug: ownerSlug.toLowerCase().trim(),
      nome_exibicao: slugRow.nome_exibicao?.trim() || medicoNome || 'Profissional',
    },
    medico: {
      nome: medicoNome || 'Profissional',
      crm,
      specialty,
    },
    portfolio: {
      historia: row.historia,
      competencias: row.competencias,
      fotos: row.fotos.map((f) => ({
        slot: f.slot,
        url: getPortfolioFotoPublicUrl(f.path),
        legenda: f.legenda ?? null,
      })),
    },
  };
}

export function portfolioToApiResponse(
  row: PortfolioRow,
  ownerSlug: string | null,
  medico: { nome: string; crm?: string | null; specialty?: string | null },
) {
  return {
    portfolio: {
      id: row.id,
      medico_slug: row.medico_slug,
      historia: row.historia,
      competencias: row.competencias,
      ativo: row.ativo,
      fotos: row.fotos.map((f) => ({
        slot: f.slot,
        url: getPortfolioFotoPublicUrl(f.path),
        legenda: f.legenda ?? null,
        path: f.path,
      })),
      public_url:
        row.ativo && ownerSlug
          ? getPortfolioPublicUrl(ownerSlug, row.medico_slug)
          : null,
      public_path:
        row.ativo && ownerSlug
          ? getPortfolioPublicPath(ownerSlug, row.medico_slug)
          : null,
    },
    medico,
    owner_slug: ownerSlug,
  };
}
