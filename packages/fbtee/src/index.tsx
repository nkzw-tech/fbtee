import fbsInternal from './fbs.tsx';
import fbtInternal from './fbt.tsx';
import type { FbsAPI, FbtAPI } from './Types.ts';

export { default as IntlVariations } from './IntlVariations.tsx';
export { default as setupFbtee } from './setupFbtee.tsx';
export { default as GenderConst } from './GenderConst.tsx';
export { default as FbtTranslations } from './FbtTranslations.tsx';
export { default as FbtResult } from './FbtResult.tsx';
export { default as list, List } from './list.tsx';

export const fbt = fbtInternal as unknown as FbtAPI;
export const fbs = fbsInternal as unknown as FbsAPI;

export type {
  FbtRuntimeInput,
  FbtRuntimeInput as TranslationTable,
} from './Hooks.tsx';
export type {
  FbtConjunction,
  FbtDelimiter,
  FbtWithoutString,
  TranslatedString,
} from './Types.ts';
export type { TranslationDictionary } from './FbtTranslations.tsx';

export {
  default as LocaleContext,
  setupLocaleContext,
  type LocaleContextProps,
  type LocaleLoaderFn,
  type TranslationPromise,
  useLocaleContext,
} from './LocaleContext.tsx';
