import fbsInternal from './fbs.tsx';
import fbtInternal from './fbt.tsx';
import type { FbsAPI, FbtAPI } from './Types.d.ts';

export { default as IntlVariations } from './IntlVariations.tsx';
export { default as setupFbtee } from './setupFbtee.tsx';
export { default as GenderConst } from './GenderConst.tsx';
export { default as FbtTranslations } from './FbtTranslations.tsx';
export { default as FbtResult } from './FbtResult.tsx';
export { default as intlList } from './intlList.tsx';

export const fbt = fbtInternal as unknown as FbtAPI;
export const fbs = fbsInternal as unknown as FbsAPI;

export type {
  FbtRuntimeInput,
  FbtRuntimeInput as Translation,
} from './Hooks.tsx';
export type { TranslatedString } from './Types.d.ts';
export type { TranslationDictionary } from './FbtTranslations.tsx';
