'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Phone } from 'lucide-react';
import {
  COMMON_PHONE_COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  formatPhoneAsYouType,
  formatPhoneDisplay,
  phoneCountryDialCode,
  phoneCountryLabel,
  type CountryCode,
} from '@/lib/phone';

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  disabled?: boolean;
  showIcon?: boolean;
  /** Exibe seletor de país (padrão: true). */
  showCountrySelect?: boolean;
};

export default function PhoneInput({
  value,
  onChange,
  country: countryProp,
  onCountryChange,
  placeholder,
  className = '',
  inputClassName = '',
  id,
  disabled = false,
  showIcon = true,
  showCountrySelect = true,
}: PhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [country, setCountry] = useState<CountryCode>(countryProp ?? DEFAULT_PHONE_COUNTRY);
  const [internationalMode, setInternationalMode] = useState(
    () => (value?.trim().startsWith('+') ?? false),
  );

  useEffect(() => {
    if (countryProp) setCountry(countryProp);
  }, [countryProp]);

  useEffect(() => {
    if (value?.trim().startsWith('+')) setInternationalMode(true);
  }, [value]);

  const effectivePlaceholder =
    placeholder ??
    (internationalMode ? '+1 305 555 1234' : '(11) 99999-9999');

  const handleCountryChange = useCallback(
    (next: CountryCode) => {
      setCountry(next);
      onCountryChange?.(next);
      if (!internationalMode && value.trim()) {
        const digits = value.replace(/\D/g, '');
        if (digits) {
          onChange(formatPhoneAsYouType(digits, next));
        }
      }
    },
    [internationalMode, onChange, onCountryChange, value],
  );

  const handleInputChange = useCallback(
    (raw: string) => {
      const trimmed = raw.trimStart();
      if (trimmed.startsWith('+')) {
        setInternationalMode(true);
        onChange(formatPhoneAsYouType(trimmed));
        return;
      }
      if (internationalMode && !raw.includes('+') && raw.replace(/\D/g, '').length === 0) {
        setInternationalMode(false);
        onChange('');
        return;
      }
      setInternationalMode(false);
      onChange(formatPhoneAsYouType(raw, country));
    },
    [country, internationalMode, onChange],
  );

  const toggleInternational = useCallback(() => {
    if (internationalMode) {
      setInternationalMode(false);
      const digits = value.replace(/\D/g, '');
      onChange(digits ? formatPhoneAsYouType(digits, country) : '');
    } else {
      setInternationalMode(true);
      const digits = value.replace(/\D/g, '');
      if (!digits) {
        onChange('+');
        return;
      }
      const e164ish = `+${getDialDigits(country)}${digits}`;
      onChange(formatPhoneAsYouType(e164ish));
    }
  }, [country, internationalMode, onChange, value]);

  return (
    <div className={`flex gap-2 ${className}`}>
      {showCountrySelect && !internationalMode ? (
        <select
          aria-label="País do telefone"
          value={country}
          disabled={disabled}
          onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
          className="shrink-0 max-w-[9.5rem] rounded-xl border border-gray-200 bg-white px-2 py-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {COMMON_PHONE_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {phoneCountryDialCode(c)} {phoneCountryLabel(c)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="relative flex-1 min-w-0">
        {showIcon ? (
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        ) : null}
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={effectivePlaceholder}
          className={`w-full rounded-xl border border-gray-200 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60 ${
            showIcon ? 'pl-10 pr-4' : 'px-4'
          } ${inputClassName}`}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleInternational}
        title={internationalMode ? 'Modo Brasil / DDD' : 'Número internacional (+)'}
        className="shrink-0 rounded-xl border border-gray-200 px-2.5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
      >
        {internationalMode ? 'BR' : '+'}
      </button>
    </div>
  );
}

function getDialDigits(country: CountryCode): string {
  return phoneCountryDialCode(country).replace(/\D/g, '');
}

/** Formata valor salvo (E.164) para o input ao carregar formulário. */
export function phoneValueForInput(
  stored: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  if (!stored?.trim()) return '';
  return formatPhoneDisplay(stored, defaultCountry);
}
