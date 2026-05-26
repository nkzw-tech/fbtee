import Hooks from './Hooks.tsx';
import { getLocaleIdentity } from './localeIdentifier.tsx';

type FormatterOptions = Readonly<{
  decimals?: number | null;
  useGrouping: boolean;
}>;

const DEFAULT_LOCALE = 'en-US';
const localeCache = new Map<string, string>();
const numberFormatCache = new Map<string, Map<string, Intl.NumberFormat>>();

function normalizeLocale(locale: string): string {
  const cachedLocale = localeCache.get(locale);
  if (cachedLocale) {
    return cachedLocale;
  }

  const identity = getLocaleIdentity(locale);
  try {
    new Intl.Locale(identity);
    localeCache.set(locale, identity);
    return identity;
  } catch {
    localeCache.set(locale, DEFAULT_LOCALE);
    return DEFAULT_LOCALE;
  }
}

function getOptionsKey({ decimals, useGrouping }: FormatterOptions): string {
  return `${useGrouping ? 'group' : 'plain'}:${decimals ?? 'default'}`;
}

function getFormatter(
  locale: string,
  options: FormatterOptions,
): Intl.NumberFormat {
  const normalizedLocale = normalizeLocale(locale);
  let formatterCacheForLocale = numberFormatCache.get(normalizedLocale);
  if (!formatterCacheForLocale) {
    formatterCacheForLocale = new Map();
    numberFormatCache.set(normalizedLocale, formatterCacheForLocale);
  }

  const optionsKey = getOptionsKey(options);
  let formatter = formatterCacheForLocale.get(optionsKey);
  if (!formatter) {
    const intlOptions: Intl.NumberFormatOptions = {
      useGrouping: options.useGrouping,
    };

    if (options.decimals != null) {
      intlOptions.maximumFractionDigits = options.decimals;
      intlOptions.minimumFractionDigits = options.decimals;
    }

    formatter = new Intl.NumberFormat(normalizedLocale, intlOptions);
    formatterCacheForLocale.set(optionsKey, formatter);
  }

  return formatter;
}

function formatNumber(value: number, decimals?: number | null): string {
  return getFormatter(Hooks.getViewerContext().locale, {
    decimals,
    useGrouping: false,
  }).format(value);
}

function formatNumberWithThousandDelimiters(
  value: number | string,
  decimals?: number | null,
): string {
  return getFormatter(Hooks.getViewerContext().locale, {
    decimals,
    useGrouping: true,
  }).format(typeof value === 'number' ? value : Number(value));
}

export default {
  formatNumber,
  formatNumberWithThousandDelimiters,
};
