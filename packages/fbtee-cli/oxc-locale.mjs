import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

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
};

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
};

function canonicalizeBCP47(locale) {
  try {
    return Intl.getCanonicalLocales(locale)[0] || locale;
  } catch {
    return locale;
  }
}

const bcp47ToLegacy = {};
const bcp47ToLegacyAliases = {};
function addBCP47ToLegacyAlias(bcp47, legacy) {
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

function getIdentityLanguage(identity) {
  try {
    return new Intl.Locale(identity).language;
  } catch {
    return identity.split(/[_-]/)[0] || identity;
  }
}

function getLegacyAlias(locale) {
  const match = locale
    .trim()
    .replaceAll('-', '_')
    .match(/^([a-z]{2,3})_([\da-z]{2,3})$/i);
  return match ? `${match[1].toLowerCase()}_${match[2].toUpperCase()}` : null;
}

export function getLocaleIdentity(locale) {
  const trimmed = locale.trim();
  const legacyAlias = getLegacyAlias(trimmed);
  if (legacyAlias) {
    const special = legacyToBCP47[legacyAlias];
    if (special) {
      return canonicalizeBCP47(special);
    }
    const specialLanguage = specialLocaleToLanguage[legacyAlias];
    if (specialLanguage) {
      const [, region] = legacyAlias.split('_');
      return canonicalizeBCP47(`${specialLanguage}-${region}`);
    }
    return canonicalizeBCP47(legacyAlias.replaceAll('_', '-'));
  }
  return canonicalizeBCP47(trimmed);
}

export function getLocaleLanguage(locale) {
  const legacyAlias = getLegacyAlias(locale);
  if (legacyAlias && specialLocaleToLanguage[legacyAlias]) {
    return specialLocaleToLanguage[legacyAlias];
  }
  return getIdentityLanguage(getLocaleIdentity(locale));
}

export function formatLocaleForStyle(locale, style = 'bcp47') {
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

export function getLocaleAliases(locale) {
  const aliases = new Set();
  const identity = getLocaleIdentity(locale);
  aliases.add(locale);
  aliases.add(identity);
  aliases.add(formatLocaleForStyle(locale, 'legacy'));
  bcp47ToLegacyAliases[identity]?.forEach((legacyAlias) => {
    aliases.add(legacyAlias);
  });
  aliases.add(getIdentityLanguage(identity));
  return [...aliases].filter(Boolean);
}

export const getEquivalentLocales = getLocaleAliases;

export function getLocaleFileAliases(locale) {
  const aliases = new Set();
  const identity = getLocaleIdentity(locale);
  aliases.add(locale);
  aliases.add(identity);
  aliases.add(formatLocaleForStyle(locale, 'legacy'));
  bcp47ToLegacyAliases[identity]?.forEach((legacyAlias) => {
    aliases.add(legacyAlias);
  });
  return [...aliases].filter(Boolean);
}

export function getConflictingLocaleFiles(files) {
  const identityToFiles = new Map();
  for (const file of files) {
    const identity = getLocaleIdentity(path.basename(file, '.json'));
    const localeFiles = identityToFiles.get(identity) || [];
    localeFiles.push(file);
    identityToFiles.set(identity, localeFiles);
  }
  return [...identityToFiles.values()].filter((localeFiles) => localeFiles.length > 1);
}

export function throwIfLocaleFileConflicts(files) {
  const conflicts = getConflictingLocaleFiles(files);
  if (conflicts.length === 0) {
    return;
  }
  throw new Error(
    conflicts
      .map((localeFiles) => {
        const identity = getLocaleIdentity(path.basename(localeFiles[0], '.json'));
        return [
          `Conflicting translation files for locale "${identity}":`,
          ...localeFiles.map((file) => `- ${file}`),
          'Keep only one file. These names refer to the same locale.',
        ].join('\n');
      })
      .join('\n\n'),
  );
}

export function getAvailableLocaleFile(directory, locale) {
  if (!existsSync(directory)) {
    return null;
  }
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(directory, file));
  const aliases = new Set(getLocaleFileAliases(locale));
  const matches = files.filter((file) => aliases.has(path.basename(file, '.json')));
  if (matches.length > 1) {
    throwIfLocaleFileConflicts(matches);
  }
  return matches[0] || null;
}
