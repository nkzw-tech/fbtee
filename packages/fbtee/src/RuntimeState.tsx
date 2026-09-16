import type { PatternHash, PatternString } from './CompilerTypes.ts';
import type { TranslationDictionary } from './FbtTranslations.tsx';
import type { Hooks } from './Hooks.tsx';
import type { LocaleFallbackOptions } from './localeFallback.tsx';
import type { BaseResult } from './Types.ts';
import IntlViewerContext from './ViewerContext.tsx';

export type ResultCache = Map<PatternString, Map<PatternHash | undefined, BaseResult | string>>;

export type RuntimeState = {
  fallbackOptions: LocaleFallbackOptions;
  hooks: Hooks;
  localeChains: Map<string, Array<string>>;
  missingTranslations: Set<string>;
  resultCaches: Map<symbol, ResultCache>;
  scoped: boolean;
  translations: TranslationDictionary;
  viewerContext: typeof IntlViewerContext;
};

export function createRuntimeState(
  viewerContext: typeof IntlViewerContext,
  scoped: boolean,
): RuntimeState {
  return {
    fallbackOptions: {},
    hooks: {},
    localeChains: new Map(),
    missingTranslations: new Set(),
    resultCaches: new Map(),
    scoped,
    translations: {},
    viewerContext,
  };
}

const defaultState = createRuntimeState(IntlViewerContext, false);
let requestStateProvider: (() => RuntimeState | undefined) | undefined;

export function registerRequestStateProvider(provider: () => RuntimeState | undefined) {
  if (requestStateProvider && requestStateProvider !== provider) {
    throw new Error('A request state provider is already registered for this fbtee runtime.');
  }
  requestStateProvider = provider;
}

export default function getRuntimeState(): RuntimeState {
  return requestStateProvider?.() ?? defaultState;
}
