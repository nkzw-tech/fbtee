const locToLang = {
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

export default {
  get(locale: string): string {
    if (locToLang[locale as unknown as keyof typeof locToLang]) {
      return locToLang[locale as unknown as keyof typeof locToLang];
    }
    const idx = locale.indexOf('_');
    return idx >= 0 ? locale.slice(0, Math.max(0, idx)) : locale;
  },
};
