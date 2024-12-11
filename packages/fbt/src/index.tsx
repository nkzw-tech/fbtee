import fbsInternal from './fbs.tsx';
import fbtInternal from './fbt.tsx';
import { FbsAPI, FbtAPI } from './Types.tsx';

export { default as IntlVariations } from './IntlVariations.tsx';
export { default as init } from './init.tsx';
export { default as GenderConst } from './GenderConst.tsx';
export { default as FbtTranslations } from './FbtTranslations.tsx';
export { default as FbtResult } from './FbtResult.tsx';
export const fbt = fbtInternal as unknown as FbtAPI;
export const fbs = fbsInternal as unknown as FbsAPI;
