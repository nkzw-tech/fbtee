import FbtHooks, {
  FbtHookRegistrations,
  FbtResolvedPayload,
} from './FbtHooks.tsx';
import FbtResult from './FbtResult.tsx';
import FbtTranslations, { TranslationDict } from './FbtTranslations.tsx';
import getFbsResult from './getFbsResult.tsx';
import IntlViewerContext from './IntlViewerContext.tsx';

export type FbtInitInput = {
  hooks?: FbtHookRegistrations | null | undefined;
  translations: TranslationDict;
};

const getFbtResult = ({ contents, errorListener }: FbtResolvedPayload) =>
  new FbtResult(contents, errorListener);

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
