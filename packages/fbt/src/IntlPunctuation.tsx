import FbtHooks from './FbtHooks';
import IntlPhonologicalRewrites from './IntlPhonologicalRewrites';
import IntlRedundantStops from './IntlRedundantStops';

/**
 * Regular expression snippet containing all the characters that we
 * count as sentence-final punctuation.
 */
export const PUNCT_CHAR_CLASS: string =
  '[.!?' +
  '\u3002' + // Chinese/Japanese period
  '\uFF01' + // Fullwidth exclamation point
  '\uFF1F' + // Fullwidth question mark
  '\u0964' + // Hindi "full stop"
  '\u2026' + // Chinese ellipsis
  '\u0EAF' + // Laotian ellipsis
  '\u1801' + // Mongolian ellipsis
  '\u0E2F' + // Thai ellipsis
  '\uFF0E' + // Fullwidth full stop
  ']';

type Rule = [RegExp, string | ((match: string) => string)];
type Rules = ReadonlyArray<Rule>;

const rulesPerLocale: {
  [locale: string]: Rules | null | undefined;
} = {};

function _getMemoizedRules(localeArg?: string | null): Rules {
  const locale = localeArg ?? '';
  let rules = rulesPerLocale[locale];
  if (rules == null) {
    rules = rulesPerLocale[locale] = _getRules(localeArg);
  }
  return rules;
}

function _getRules(locale?: string | null): Rules {
  const rules: Array<Rule> = [];
  const rewrites = IntlPhonologicalRewrites.get(locale);

  for (let pattern in rewrites.patterns) {
    let replacement: string | ((match: string) => string) =
      rewrites.patterns[pattern];
    // "Metaclasses" are shorthand for larger character classes. For example,
    // _C may refer to consonants and _V to vowels for a locale.
    for (const metaclass in rewrites.meta) {
      const metaclassRegexp = new RegExp(metaclass.slice(1, -1), 'g');
      const characterClass = rewrites.meta[metaclass];
      pattern = pattern.replace(metaclassRegexp, characterClass);
      replacement = replacement.replace(metaclassRegexp, characterClass);
    }
    if (replacement === 'javascript') {
      replacement = (match) => match.slice(1).toLowerCase();
    }
    rules.push([new RegExp(pattern.slice(1, -1), 'g'), replacement]);
  }
  return rules;
}

/**
 * Applies phonological rules (appropriate to the locale)
 * at the morpheme boundary when tokens are replaced with values.
 * For languages like Turkish, we allow translators to use shorthand
 * for a pattern of inflection (a suffix like '(y)i becomes 'i or 'yi or 'a or
 * 'ye, etc. depending on context).
 *
 * Input: Translated string with each {token} substituted with
 *        "\x01value\x01" (e.g., "\x01Ozgur\x01(y)i..." which was
 *        "{name}(y)i...")
 * Returns: String with phonological rules applied (e.g., "Ozguri...")
 */
export function applyPhonologicalRules(text: string): string {
  const rules = _getMemoizedRules(FbtHooks.getViewerContext().locale);
  let result = text;

  for (const [regexp, replacement] of rules) {
    // @ts-expect-error
    result = result.replace(regexp, replacement);
  }

  return result.replaceAll('', '');
}

/**
 * Map all equivalencies to the normalized key for the stop category.  These
 * are the entries in the redundancy mapping
 */
const _normalizedStops = new Map<string, string>();
for (const norm in IntlRedundantStops.equivalencies) {
  for (const eq of [norm].concat(
    IntlRedundantStops.equivalencies[
      norm as keyof typeof IntlRedundantStops.equivalencies
    ]
  )) {
    _normalizedStops.set(eq, norm);
  }
}

const _redundancies = new Map<
  string | null | undefined,
  Set<string | null | undefined>
>();
for (const prefix in IntlRedundantStops.redundancies) {
  _redundancies.set(
    prefix,
    new Set(
      IntlRedundantStops.redundancies[
        prefix as keyof typeof IntlRedundantStops.redundancies
      ]
    )
  );
}

function isRedundant(rawPrefix: string, rawSuffix: string): boolean {
  const prefix = _normalizedStops.get(rawPrefix);
  const suffix = _normalizedStops.get(rawSuffix);
  return _redundancies.get(prefix)?.has(suffix) === true;
}

/**
 * If suffix is redundant with prefix (as determined by the redundancy map),
 * return the empty string, otherwise return suffix.
 */
export function dedupeStops(prefix: string, suffix: string): string {
  // We can naively grab the last "character" (a general Unicode "no-no") from
  // our string because we know our set of stops we test against have no
  // diacritics nor lie outside the BMP
  return isRedundant(prefix.at(-1) || '', suffix) ? '' : suffix;
}
