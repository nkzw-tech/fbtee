import { AsyncLocalStorage } from 'node:async_hooks';
import type { TranslationDictionary } from './FbtTranslations.tsx';
import type { Hooks } from './Hooks.tsx';
import { createRuntimeState, registerRequestStateProvider, RuntimeState } from './RuntimeState.tsx';
import setupFbtee from './setupFbtee.tsx';
import { Gender, resolveGender } from './setupLocaleContext.tsx';

const storage = new AsyncLocalStorage<RuntimeState>();
registerRequestStateProvider(() => storage.getStore());

export type FbteeRequestOptions = Readonly<{
  gender?: Gender;
  hooks?: Hooks;
  locale: string;
  translations: TranslationDictionary;
}>;

export function runWithFbtee<T>(
  { gender = 'unknown', hooks, locale, translations }: FbteeRequestOptions,
  callback: () => T,
): T {
  const state = createRuntimeState({ GENDER: resolveGender(gender), locale }, true);
  return storage.run(state, () => {
    setupFbtee({ hooks, translations });
    return callback();
  });
}

export * from './index-core.tsx';
