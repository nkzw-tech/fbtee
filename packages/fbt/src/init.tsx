import { PatternHash } from 'babel-plugin-fbt';
import FbtResult from './FbtResult.tsx';
import FbtTranslations, { TranslationDict } from './FbtTranslations.tsx';
import getFbsResult from './getFbsResult.tsx';
import Hook, { Hooks } from './Hooks.tsx';
import IntlViewerContext from './IntlViewerContext.tsx';
import { IFbtErrorListener, NestedFbtContentItems } from './Types.tsx';

const getFbtResult = (
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null
) => new FbtResult(contents, errorListener, hashKey);

export default function init({
  hooks,
  translations,
}: {
  hooks?: Hooks | null;
  translations: TranslationDict;
}) {
  FbtTranslations.registerTranslations(translations);

  if (!hooks) {
    hooks = {};
  }

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

  Hook.register(hooks);
}
