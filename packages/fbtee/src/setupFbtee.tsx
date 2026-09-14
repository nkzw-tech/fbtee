import type { PatternHash } from './CompilerTypes.ts';
import FbtResult from './FbtResult.tsx';
import FbtTranslations, { TranslationDictionary } from './FbtTranslations.tsx';
import getFbsResult from './getFbsResult.tsx';
import Hook, { Hooks } from './Hooks.tsx';
import getRuntimeState from './RuntimeState.tsx';
import type { IFbtErrorListener, NestedFbtContentItems } from './Types.js';

const hasWindow = typeof window !== 'undefined';

const getFbtResult = (
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null,
) => {
  const result = new FbtResult(contents, errorListener, hashKey);
  if (hasWindow) {
    return result;
  }

  const resolvedContents = result.getContents();
  return (resolvedContents?.length === 1 && typeof resolvedContents[0] === 'string'
    ? resolvedContents[0]
    : resolvedContents) as unknown as FbtResult;
};

export default function setupFbtee({
  hooks,
  translations,
}: {
  hooks?: Hooks | null;
  translations: TranslationDictionary;
}) {
  FbtTranslations.registerTranslations(translations);

  if (getRuntimeState().scoped) {
    hooks = { ...hooks };
  } else if (!hooks) {
    hooks = {};
  }

  if (!hooks.getFbtResult) {
    hooks.getFbtResult = getFbtResult;
  }
  if (!hooks.getFbsResult) {
    hooks.getFbsResult = getFbsResult;
  }
  if (!hooks.getTranslatedInput) {
    hooks.getTranslatedInput = FbtTranslations.getTranslatedInput;
  }
  if (!hooks.getViewerContext) {
    hooks.getViewerContext = () => getRuntimeState().viewerContext;
  }

  Hook.register(hooks);
}
