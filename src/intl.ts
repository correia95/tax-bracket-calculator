// Reference copy of the shared lightweight i18n helper placed in finance apps as
// src/intl.ts. Keep these in sync when the pattern changes.

const REGION_CCY: Record<string, string> = {
  AU: 'AUD', US: 'USD', GB: 'GBP', CA: 'CAD', NZ: 'NZD', IN: 'INR', SG: 'SGD',
  ZA: 'ZAR', JP: 'JPY', CH: 'CHF', HK: 'HKD',
  IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
};

export const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'CAD', 'NZD', 'INR', 'SGD', 'ZAR', 'JPY'];

export function guessCurrency(): string {
  try {
    const langs = (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language]) as string[];
    for (const l of langs) {
      let region: string | undefined;
      try {
        region = new Intl.Locale(l).maximize().region;
      } catch {
        region = (l.split('-')[1] || '').toUpperCase() || undefined;
      }
      if (region && REGION_CCY[region]) return REGION_CCY[region];
    }
  } catch {
    /* ignore */
  }
  return 'AUD';
}

export function money(n: number, currency: string, dp = 2): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(dp)}`;
  }
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
