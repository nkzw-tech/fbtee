import FbtTranslations, {
  getTranslatedInput,
  registerTranslations,
  TranslationDictionary,
} from './FbtTranslations.tsx';
import getFbsResult from './getFbsResult.tsx';
import getFbtResult from './getFbtResult.tsx';
import Hook, { Hooks } from './Hooks.tsx';
import type { LocaleFallbackOptions } from './localeFallback.tsx';
import getRuntimeState, { RuntimeState } from './RuntimeState.tsx';

const getDefaultViewerContext = () => getRuntimeState().viewerContext;

type SetupOptions = LocaleFallbackOptions & {
  hooks?: Hooks | null;
  translations: TranslationDictionary;
};

export default function setupFbtee(options: SetupOptions) {
  setupRuntime(getRuntimeState(), options);
}

export function setupRuntime(
  state: RuntimeState,
  { hooks, translations, ...fallbackOptions }: SetupOptions,
) {
  state.fallbackOptions = fallbackOptions;
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
