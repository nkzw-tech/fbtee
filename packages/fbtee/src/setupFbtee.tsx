import type { PatternHash } from './CompilerTypes.ts';
import FbtResult from './FbtResult.tsx';
import FbtTranslations, {
  getTranslatedInput,
  registerTranslations,
  TranslationDictionary,
} from './FbtTranslations.tsx';
import getFbsResult from './getFbsResult.tsx';
import Hook, { Hooks } from './Hooks.tsx';
import getRuntimeState, { RuntimeState } from './RuntimeState.tsx';
import type { IFbtErrorListener, NestedFbtContentItems } from './Types.js';

const hasWindow = typeof window !== 'undefined';
const getDefaultViewerContext = () => getRuntimeState().viewerContext;

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

type SetupOptions = {
  hooks?: Hooks | null;
  translations: TranslationDictionary;
};

export default function setupFbtee(options: SetupOptions) {
  setupRuntime(getRuntimeState(), options);
}

export function setupRuntime(state: RuntimeState, { hooks, translations }: SetupOptions) {
  registerTranslations(state, translations);

  if (state.scoped) {
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
  if (
    !hooks.getTranslatedInput ||
    hooks.getTranslatedInput === FbtTranslations.getTranslatedInput
  ) {
    hooks.getTranslatedInput = state.scoped
      ? (input) => getTranslatedInput(input, state)
      : FbtTranslations.getTranslatedInput;
  }
  if (!hooks.getViewerContext || hooks.getViewerContext === getDefaultViewerContext) {
    hooks.getViewerContext = state.scoped ? () => state.viewerContext : getDefaultViewerContext;
  }

  Hook.register(hooks, state);
}
