export type LocaleStyle = 'bcp47' | 'legacy' | 'preserve';

const legacyToBCP47 = {
  ar_AR: 'ar',
  es_LA: 'es-419',
  fb_AA: 'fb-AA',
  fb_AC: 'fb-AC',
  fb_AR: 'ar',
  fb_HA: 'fb-HA',
  fb_HX: 'fb-HX',
  fb_LL: 'fb-LL',
  fb_LS: 'fb-LS',
  fb_RL: 'fb-RL',
  fb_ZH: 'zh',
  fbt_AC: 'fbt-AC',
} as const;

const specialLocaleToLanguage = {
  bp_IN: 'bho',
  bv_DE: 'bar',
  cb_IQ: 'ckb',
  ck_US: 'chr',
  cx_PH: 'ceb',
  eh_IN: 'hi',
  em_ZM: 'bem',
  fb_AA: 'en',
  fb_AC: 'en',
  fb_AR: 'ar',
  fb_HA: 'en',
  fb_HX: 'en',
  fb_LL: 'en',
  fb_LS: 'en',
  fb_RL: 'en',
  fb_ZH: 'zh',
  fbt_AC: 'en',
  fn_IT: 'fur',
  fv_NG: 'fuv',
  gx_GR: 'grc',
  lr_IT: 'lij',
  nh_MX: 'nah',
  ns_ZA: 'nso',
  qb_DE: 'hsb',
  qc_GT: 'quc',
  qe_US: 'esu',
  qk_DZ: 'kab',
  qr_GR: 'rup',
  qs_DE: 'dsb',
  qt_US: 'tli',
  qv_IT: 'vec',
  qz_MM: 'my',
  sy_SY: 'syr',
  sz_PL: 'szl',
  tl_PH: 'fil',
  tl_ST: 'tlh',
  tq_AR: 'tob',
  tz_MA: 'tzm',
  zz_TR: 'zza',
} as const;

function canonicalizeBCP47(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] || locale;
  } catch {
    return locale;
  }
}

const bcp47ToLegacy: Record<string, string> = {};
const bcp47ToLegacyAliases: Record<string, Array<string>> = {};
function addBCP47ToLegacyAlias(bcp47: string, legacy: string): void {
  const identity = canonicalizeBCP47(bcp47);
  bcp47ToLegacy[identity] ??= legacy;
  const aliases = bcp47ToLegacyAliases[identity] || [];
  aliases.push(legacy);
  bcp47ToLegacyAliases[identity] = aliases;
}

for (const [legacy, bcp47] of Object.entries(legacyToBCP47)) {
  addBCP47ToLegacyAlias(bcp47, legacy);
}
for (const [legacy, language] of Object.entries(specialLocaleToLanguage)) {
  const [, region] = legacy.split('_');
  addBCP47ToLegacyAlias(`${language}-${region}`, legacy);
}

function getIdentityLanguage(identity: string): string {
  try {
    return new Intl.Locale(identity).language;
  } catch {
    return identity.split(/[_-]/)[0] || identity;
  }
}

function getLegacyAlias(locale: string): string | null {
  const match = locale
    .trim()
    .replaceAll('-', '_')
    .match(/^([a-z]{2,3})_([\da-z]{2,3})$/i);
  if (!match) {
    return null;
  }

  const normalized = `${match[1].toLowerCase()}_${match[2].toUpperCase()}`;
  if (legacyToBCP47[normalized as keyof typeof legacyToBCP47]) {
    return normalized;
  }
  return normalized;
}

export function getLocaleIdentity(locale: string): string {
  const trimmed = locale.trim();
  const legacyAlias = getLegacyAlias(trimmed);
  if (legacyAlias) {
    const special = legacyToBCP47[legacyAlias as keyof typeof legacyToBCP47];
    if (special) {
      return canonicalizeBCP47(special);
    }
    const specialLanguage =
      specialLocaleToLanguage[
        legacyAlias as keyof typeof specialLocaleToLanguage
      ];
    if (specialLanguage) {
      const [, region] = legacyAlias.split('_');
      return canonicalizeBCP47(`${specialLanguage}-${region}`);
    }
    return canonicalizeBCP47(legacyAlias.replaceAll('_', '-'));
  }
  return canonicalizeBCP47(trimmed);
}

export function getLocaleLanguage(locale: string): string {
  const legacyAlias = getLegacyAlias(locale);
  if (
    legacyAlias &&
    specialLocaleToLanguage[legacyAlias as keyof typeof specialLocaleToLanguage]
  ) {
    return specialLocaleToLanguage[
      legacyAlias as keyof typeof specialLocaleToLanguage
    ];
  }

  const identity = getLocaleIdentity(locale);
  return getIdentityLanguage(identity);
}

export function formatLocaleForStyle(
  locale: string,
  style: LocaleStyle = 'bcp47',
): string {
  if (style === 'preserve') {
    return locale;
  }

  const identity = getLocaleIdentity(locale);
  if (style === 'bcp47') {
    return identity;
  }

  const knownLegacy = bcp47ToLegacy[identity];
  if (knownLegacy) {
    return knownLegacy;
  }

  const legacyAlias = getLegacyAlias(locale);
  if (legacyAlias) {
    return legacyAlias;
  }

  try {
    const intlLocale = new Intl.Locale(identity);
    return intlLocale.region
      ? `${intlLocale.language}_${intlLocale.region}`
      : identity.replaceAll('-', '_');
  } catch {
    return identity.replaceAll('-', '_');
  }
}

export function getLocaleAliases(locale: string): ReadonlyArray<string> {
  const aliases = new Set<string>();
  const identity = getLocaleIdentity(locale);
  aliases.add(locale);
  aliases.add(identity);
  aliases.add(formatLocaleForStyle(locale, 'legacy'));
  bcp47ToLegacyAliases[identity]?.forEach((legacyAlias) => {
    aliases.add(legacyAlias);
  });
  aliases.add(getIdentityLanguage(identity));
  return Array.from(aliases).filter(Boolean);
}

export function getLocaleFileAliases(locale: string): ReadonlyArray<string> {
  const aliases = new Set<string>();
  const identity = getLocaleIdentity(locale);
  aliases.add(locale);
  aliases.add(identity);
  aliases.add(formatLocaleForStyle(locale, 'legacy'));
  bcp47ToLegacyAliases[identity]?.forEach((legacyAlias) => {
    aliases.add(legacyAlias);
  });
  return Array.from(aliases).filter(Boolean);
}
