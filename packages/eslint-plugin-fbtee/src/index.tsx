import packageJson from '../package.json' with { type: 'json' };
import noEmptyStringsRule from './rules/no-empty-strings.tsx';
import noUnhelpfulDesc from './rules/no-unhelpful-desc.tsx';
import noUntranslatedStrings from './rules/no-untranslated-strings.tsx';

export default {
  configs: {
    recommended: {
      rules: {
        '@nkzw/fbtee/no-empty-strings': 2,
        '@nkzw/fbtee/no-unhelpful-desc': 2,
      },
    },
    strict: {
      rules: {
        '@nkzw/fbtee/no-empty-strings': 2,
        '@nkzw/fbtee/no-unhelpful-desc': 2,
        '@nkzw/fbtee/no-untranslated-strings': 2,
      },
    },
  },
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: {
    'no-empty-strings': noEmptyStringsRule,
    'no-unhelpful-desc': noUnhelpfulDesc,
    'no-untranslated-strings': noUntranslatedStrings,
  },
};
