import {
  AsYouType,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js';

export type { CountryCode };

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'BR';

/** Países mais usados no cadastro (Brasil primeiro). */
export const COMMON_PHONE_COUNTRIES: CountryCode[] = [
  'BR',
  'US',
  'PT',
  'AR',
  'UY',
  'PY',
  'CL',
  'CO',
  'PE',
  'MX',
  'ES',
  'GB',
  'FR',
  'DE',
  'IT',
  'CA',
  'AU',
  'JP',
  'CN',
];

export const PHONE_COUNTRY_LABELS: Partial<Record<CountryCode, string>> = {
  BR: 'Brasil',
  US: 'Estados Unidos',
  PT: 'Portugal',
  AR: 'Argentina',
  UY: 'Uruguai',
  PY: 'Paraguai',
  CL: 'Chile',
  CO: 'Colômbia',
  PE: 'Peru',
  MX: 'México',
  ES: 'Espanha',
  GB: 'Reino Unido',
  FR: 'França',
  DE: 'Alemanha',
  IT: 'Itália',
  CA: 'Canadá',
  AU: 'Austrália',
  JP: 'Japão',
  CN: 'China',
};

export function phoneCountryLabel(code: CountryCode): string {
  return PHONE_COUNTRY_LABELS[code] ?? code;
}

export function phoneCountryDialCode(code: CountryCode): string {
  return `+${getCountryCallingCode(code)}`;
}

function tryParse(input: string, defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('+')) {
      const p = parsePhoneNumberFromString(trimmed);
      return p?.isValid() ? p : null;
    }
    const p = parsePhoneNumberFromString(trimmed, defaultCountry);
    return p?.isValid() ? p : null;
  } catch {
    return null;
  }
}

/** E.164 (+5511999999999) ou null se inválido. */
export function normalizePhoneE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  if (!input?.trim()) return null;
  const p = tryParse(input, defaultCountry);
  return p ? p.format('E.164') : null;
}

/** Dígitos com DDI (5511999999999) — WhatsApp, índices Supabase. */
export function normalizePhoneDigits(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const e164 = normalizePhoneE164(input, defaultCountry);
  return e164 ? e164.replace(/\D/g, '') : null;
}

/** Valor canônico para persistência (E.164). */
export function normalizePhoneForStorage(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  return normalizePhoneE164(input, defaultCountry);
}

export function isValidPhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
  if (!input?.trim()) return false;
  return tryParse(input, defaultCountry) !== null;
}

/** Formata para exibição: nacional BR ou internacional com +. */
export function formatPhoneDisplay(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  if (!input?.trim()) return '';
  const p = tryParse(input, defaultCountry);
  if (p) {
    if (p.country === 'BR') return p.formatNational();
    return p.formatInternational();
  }
  return formatPhoneAsYouType(input, defaultCountry);
}

/** Máscara durante digitação (AsYouType). */
export function formatPhoneAsYouType(
  input: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  if (!input) return '';
  const trimmed = input.trimStart();
  if (trimmed.startsWith('+')) {
    return new AsYouType().input(trimmed);
  }
  return new AsYouType(defaultCountry).input(input);
}

/** Detecta país a partir de número já salvo ou parcial. */
export function detectPhoneCountry(
  input: string | null | undefined,
  fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): CountryCode {
  if (!input?.trim()) return fallback;
  if (input.trim().startsWith('+')) {
    const p = parsePhoneNumberFromString(input.trim());
    if (p?.country) return p.country;
  }
  const p = tryParse(input, fallback);
  if (p?.country) return p.country;
  return fallback;
}

/** Dígitos locais BR (DDD + número) — compatibilidade. */
export function brPhoneLocalDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  const p = tryParse(phone, DEFAULT_PHONE_COUNTRY);
  if (p?.country === 'BR') return p.nationalNumber;
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return d.slice(2);
  if (d.startsWith('0') && d.length >= 11) return d.slice(1);
  if (d.length > 11) return d.slice(-11);
  return d;
}

/** Alias histórico — formata para exibição. */
export function formatarTelefoneBr(phone: string | null | undefined): string {
  return formatPhoneDisplay(phone, DEFAULT_PHONE_COUNTRY);
}

/** Dígitos E.164 sem + para comparação; fallback em dígitos brutos. */
export function phoneDigits(phone: string | null | undefined): string {
  const d = normalizePhoneDigits(phone ?? '');
  if (d) return d;
  return (phone ?? '').replace(/\D/g, '');
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const da = normalizePhoneDigits(a ?? '');
  const db = normalizePhoneDigits(b ?? '');
  if (da && db) return da === db;
  const rawA = (a ?? '').replace(/\D/g, '');
  const rawB = (b ?? '').replace(/\D/g, '');
  if (!rawA || !rawB) return false;
  if (rawA === rawB) return true;
  if (rawA.length >= 10 && rawB.length >= 10 && rawA.slice(-9) === rawB.slice(-9)) return true;
  return false;
}

/** Dígitos com DDI para api.whatsapp.com (sem +). */
export function normalizeForWhatsApp(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (digits) return digits;
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55')) return d;
  return `55${d}`;
}

/** @deprecated Use normalizeForWhatsApp */
export function normalizeBrazilPhone(phone: string): string {
  return normalizeForWhatsApp(phone);
}

export function telefonePreenchido(tel: string | null | undefined): boolean {
  return isValidPhone(tel);
}

export const PHONE_VALIDATION_MESSAGE =
  'Informe um telefone válido com DDD (ex.: 11 99999-9999) ou internacional (ex.: +1 305 555 1234).';
