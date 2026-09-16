import { getLocaleIdentity } from './localeIdentifier.tsx';

export type FallbackLocales =
  | ReadonlyArray<string>
  | Readonly<Record<string, ReadonlyArray<string>>>;

export type MissingTranslation = Readonly<{
  hashKey: string;
  locale: string;
  sourceLocale: string;
}>;

export type LocaleFallbackOptions = Readonly<{
  /** Additional fallbacks, after language/script parents and before the source locale. */
  fallbackLocales?: FallbackLocales;
  /** Called once per locale/message when the entire catalog chain is missing it. */
  onMissingTranslation?: (missing: MissingTranslation) => void;
  /** Language of the inline messages. Defaults to en-US. */
  sourceLocale?: string;
}>;

const hierarchies = new Map<string, ReadonlyArray<string>>();

function parseLocale(locale: string): Intl.Locale | null {
  try {
    return new Intl.Locale(locale);
  } catch {
    return null;
  }
}

/** Locale parents must not silently switch writing systems (e.g. Hant to Hans). */
export function getLocaleHierarchy(locale: string): ReadonlyArray<string> {
  const cached = hierarchies.get(locale);
  if (cached) {
    return cached;
  }
  const identity = getLocaleIdentity(locale);
  const result = new Set([identity]);
  const parsed = parseLocale(identity);
  if (parsed) {
    result.add(parsed.baseName);
    result.add([parsed.language, parsed.script, parsed.region].filter(Boolean).join('-'));
    const script = parsed.maximize().script;
    if (script) {
      result.add(`${parsed.language}-${script}`);
    }
    if (script === new Intl.Locale(parsed.language).maximize().script) {
      result.add(parsed.language);
    }
  }
  const hierarchy = Array.from(result);
  hierarchies.set(locale, hierarchy);
  return hierarchy;
}

export function getLocaleFallbackChain(
  locale: string,
  { fallbackLocales, sourceLocale = 'en-US' }: LocaleFallbackOptions = {},
): ReadonlyArray<string> {
  const result = new Set<string>();
  const mappings = new Map<string, ReadonlyArray<string>>();
  if (fallbackLocales && !Array.isArray(fallbackLocales)) {
    for (const [key, values] of Object.entries(fallbackLocales)) {
      mappings.set(key === 'default' ? key : getLocaleIdentity(key), values);
    }
  }
  const append = (value: string) => {
    const added: Array<string> = [];
    for (const parent of getLocaleHierarchy(value)) {
      if (!result.has(parent)) {
        result.add(parent);
        added.push(parent);
      }
    }
    for (const parent of added) {
      mappings.get(parent)?.forEach(append);
    }
  };
  append(locale);
  const defaults = Array.isArray(fallbackLocales) ? fallbackLocales : mappings.get('default');
  defaults?.forEach(append);
  append(sourceLocale);
  return Array.from(result);
}

/** Match identities, not lossy aliases: zh-Hant-TW and zh-Hans-TW are distinct. */
export function getAvailableLocaleChain(
  locale: string,
  availableLocales: Iterable<string>,
  options: LocaleFallbackOptions = {},
): Array<string> {
  const available = Array.from(availableLocales);
  return Array.from(
    new Set(
      getLocaleFallbackChain(locale, options).flatMap((identity) =>
        available
          .filter((candidate) => areEquivalentLocales(candidate, identity))
          .sort((a, b) => (a === identity ? -1 : b === identity ? 1 : a < b ? -1 : a > b ? 1 : 0)),
      ),
    ),
  );
}

export function areEquivalentLocales(a: string, b: string): boolean {
  const left = getLocaleIdentity(a);
  const right = getLocaleIdentity(b);
  if (left === right) {
    return true;
  }
  const leftLocale = parseLocale(left);
  const rightLocale = parseLocale(right);
  return (
    !!leftLocale &&
    !!rightLocale &&
    left === leftLocale.baseName &&
    right === rightLocale.baseName &&
    leftLocale.language === rightLocale.language &&
    leftLocale.region === rightLocale.region &&
    leftLocale.maximize().baseName === rightLocale.maximize().baseName
  );
}

/** Prefer exact matches and parents, then a deterministic region with the same script. */
export function negotiateLocale(locale: string, availableLocales: Iterable<string>): string | null {
  const available = Array.from(availableLocales);
  const parents = getAvailableLocaleChain(locale, available, { sourceLocale: locale });
  if (parents.length) {
    return parents[0];
  }
  const requested = parseLocale(getLocaleIdentity(locale));
  if (!requested) {
    return null;
  }
  const maximized = requested.maximize();
  const defaultRegion = new Intl.Locale(
    [requested.language, maximized.script].filter(Boolean).join('-'),
  ).maximize().region;
  return (
    available
      .map((name) => ({ locale: parseLocale(getLocaleIdentity(name)), name }))
      .filter(
        ({ locale }) =>
          locale &&
          locale.language === requested.language &&
          locale.maximize().script === maximized.script,
      )
      .sort((a, b) => {
        const score = (value: Intl.Locale | null) =>
          value?.region === maximized.region ? 2 : value?.region === defaultRegion ? 1 : 0;
        return (
          score(b.locale) - score(a.locale) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        );
      })[0]?.name ?? null
  );
}
