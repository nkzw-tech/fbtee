import packageJson from '../package.json' with { type: 'json' };
import noEmptyStringsRule from './rules/no-empty-strings.tsx';
import noUnhelpfulDesc from './rules/no-unhelpful-desc.tsx';
import noUntranslatedStrings from './rules/no-untranslated-strings.tsx';

export const meta = {
  name: packageJson.name,
  version: packageJson.version,
};

export const rules = {
  'no-empty-strings': noEmptyStringsRule,
  'no-unhelpful-desc': noUnhelpfulDesc,
  'no-untranslated-strings': noUntranslatedStrings,
};

export const configs = {
  strict: {
    rules: {
      '@nkzw/fbtee/no-empty-strings': 2,
      '@nkzw/fbtee/no-unhelpful-desc': 2,
      '@nkzw/fbtee/no-untranslated-strings': 2,
    },
  },
};
