import fbsInternal from './fbs';
import fbtInternal from './fbt';
import init from './fbtInit';
import FbtResult from './FbtResult';
import FbtTranslations from './FbtTranslations';
import GenderConst from './GenderConst';
import IntlVariations from './IntlVariations';
import { FbsAPI, FbtAPI } from './Types';

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
