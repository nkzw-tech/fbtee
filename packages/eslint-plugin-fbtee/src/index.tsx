import packageJson from '../package.json' with { type: 'json' };
import noEmptyStringsRule from './rules/no-empty-strings.tsx';

export const meta = {
  name: packageJson.name,
  version: packageJson.version,
};

export const rules = {
  'no-empty-strings': noEmptyStringsRule,
};
