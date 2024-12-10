import fbsInternal from './fbs.tsx';
import fbtInternal from './fbt.tsx';
import init from './fbtInit.tsx';
import FbtResult from './FbtResult.tsx';
import FbtTranslations from './FbtTranslations.tsx';
import GenderConst from './GenderConst.tsx';
import IntlVariations from './IntlVariations.tsx';
import { FbsAPI, FbtAPI } from './Types.tsx';

const fbt = fbtInternal as unknown as FbtAPI;
const fbs = fbsInternal as unknown as FbsAPI;

export {
  fbs,
  fbt,
  FbtResult,
  FbtTranslations,
  GenderConst,
  init,
  IntlVariations,
};
