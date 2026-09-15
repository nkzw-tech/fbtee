import { createFbsRuntime } from './fbs.tsx';
import { createFbtRuntime } from './fbt.tsx';
import { mergeTranslations, TranslationDictionary } from './FbtTranslations.tsx';
import type { Hooks } from './Hooks.tsx';
import list, { listWithRuntime } from './list.tsx';
import { createRuntimeState } from './RuntimeState.tsx';
import { setupRuntime } from './setupFbtee.tsx';
import { Gender, resolveGender } from './setupLocaleContext.tsx';
import type { FbsAPI, FbtAPI } from './Types.ts';

export type FbteeRuntimeOptions = Readonly<{
  gender?: Gender;
  hooks?: Omit<Hooks, 'getViewerContext'>;
  locale: string;
  translations: TranslationDictionary;
}>;

export type FbteeRuntime = Readonly<{
  fbs: FbsAPI;
  fbt: FbtAPI;
  list: (
    items: Parameters<typeof list>[0],
    conjunction?: Parameters<typeof list>[1],
    delimiter?: Parameters<typeof list>[2],
    options?: Parameters<typeof list>[3],
  ) => ReturnType<typeof list>;
  locale: string;
  mergeTranslations: (translations: TranslationDictionary) => void;
}>;

type RuntimeStore = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

const stores = new WeakMap<FbteeRuntime, RuntimeStore>();

export function getRuntimeStore(runtime: FbteeRuntime): RuntimeStore {
  const store = stores.get(runtime);
  if (!store) {
    throw new Error(
      "getRuntimeStore: 'LocaleProvider' requires a runtime created by 'createFbteeRuntime'",
    );
  }
  return store;
}

export default function createFbteeRuntime({
  gender = 'unknown',
  hooks,
  locale,
  translations,
}: FbteeRuntimeOptions): FbteeRuntime {
  const state = createRuntimeState({ GENDER: resolveGender(gender), locale }, true);
  setupRuntime(state, {
    hooks: { ...hooks, getViewerContext: () => state.viewerContext },
    translations,
  });
  const fbtRuntime = createFbtRuntime(state);
  const fbt = fbtRuntime as unknown as FbtAPI;
  let revision = 0;
  let listeners: Set<() => void> | undefined;
  const runtime: FbteeRuntime = {
    fbs: createFbsRuntime(fbtRuntime, state) as unknown as FbsAPI,
    fbt,
    list: (items, conjunction, delimiter, options) =>
      listWithRuntime(items, conjunction, delimiter, options, fbt),
    locale,
    mergeTranslations: (translations) => {
      mergeTranslations(state, translations);
      revision++;
      listeners?.forEach((listener) => listener());
    },
  };
  stores.set(runtime, {
    getSnapshot: () => revision,
    subscribe: (listener) => {
      (listeners ??= new Set()).add(listener);
      return () => {
        listeners?.delete(listener);
      };
    },
  });
  return runtime;
}
