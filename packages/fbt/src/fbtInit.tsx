import FbtHooks, { FbtHookRegistrations } from './FbtHooks';
import FbtResult from './FbtResult';
import FbtTranslations, { TranslationDict } from './FbtTranslations';
import getFbsResult from './getFbsResult';
import IntlViewerContext from './IntlViewerContext';

export type FbtInitInput = {
  hooks?: FbtHookRegistrations | null | undefined;
  translations: TranslationDict;
};

const getFbtResult = FbtResult.get.bind(FbtResult);

export default function fbtInit(input: FbtInitInput): void {
  FbtTranslations.registerTranslations(input.translations);

  // Hookup default implementations
  const hooks = input.hooks ?? {};
  if (hooks.getFbtResult == null) {
    hooks.getFbtResult = getFbtResult;
  }
  if (hooks.getFbsResult == null) {
    hooks.getFbsResult = getFbsResult;
  }
  if (hooks.getTranslatedInput == null) {
    hooks.getTranslatedInput = FbtTranslations.getTranslatedInput;
  }
  if (hooks.getViewerContext == null) {
    hooks.getViewerContext = () => IntlViewerContext;
  }

  FbtHooks.register(hooks);
}
