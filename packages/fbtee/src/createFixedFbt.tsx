import { fbsParam, fbsPlural } from './fbs.tsx';
import { createRuntime, fbtParam, fbtPlural } from './fbt.tsx';
import FbtTranslations from './FbtTranslations.tsx';
import Hooks, { FbtRuntimeCallInput, FbtTranslatedInput } from './Hooks.tsx';
import IntlVariations from './IntlVariations.tsx';
import { Gender, resolveGender } from './setupLocaleContext.tsx';

export default function createFixedFbt(locale: string, gender?: Gender) {
  const resolvedGender = gender
    ? resolveGender(gender)
    : IntlVariations.GENDER_UNKNOWN;

  const getViewerContext = () => ({
    GENDER: resolvedGender,
    locale,
  });

  const getTranslatedInput = ({
    args,
    options,
    table,
  }: FbtRuntimeCallInput): FbtTranslatedInput => {
    const hashKey = options?.hk;
    const translations = FbtTranslations.getRegisteredTranslations()[locale];

    return hashKey == null || translations?.[hashKey] == null
      ? { args, table }
      : { args, table: translations[hashKey] };
  };

  const fbt = createRuntime({
    getErrorListener: Hooks.getErrorListener,
    getResult: Hooks.getFbtResult,
    getTranslatedInput,
    getViewerContext,
    param: fbtParam,
    plural: fbtPlural,
  });

  const fbs = createRuntime({
    getErrorListener: Hooks.getErrorListener,
    getResult: Hooks.getFbsResult,
    getTranslatedInput,
    getViewerContext,
    param: fbsParam,
    plural: fbsPlural,
  });

  return { fbs, fbt };
}
