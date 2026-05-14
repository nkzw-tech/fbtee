import { createContext, ReactNode, use, useMemo } from 'react';
import createFixedFbt from './createFixedFbt.tsx';
import type { FbtLocaleOverride } from './fbt.tsx';
import FbtTranslations from './FbtTranslations.tsx';
import Hooks, { setLocaleOverrideHook } from './Hooks.tsx';
import type { Gender } from './setupLocaleContext.tsx';

const FbtLocaleOverrideContext = createContext<FbtLocaleOverride>(null);

setLocaleOverrideHook(() => use(FbtLocaleOverrideContext));

const localeLoadPromises = new Map<string, Promise<void>>();

function useEnsureLocaleLoaded(locale: string): void {
  const translations = FbtTranslations.getRegisteredTranslations();
  if (translations[locale]) {
    return;
  }

  const loadLocale = Hooks.getLoadLocale();
  if (!loadLocale) {
    return;
  }

  let promise = localeLoadPromises.get(locale);
  if (!promise) {
    promise = loadLocale(locale).then((result) => {
      FbtTranslations.mergeTranslations({ [locale]: result });
    });
    localeLoadPromises.set(locale, promise);
  }

  use(promise);
}

/**
 * Provides a fixed locale for all `<fbt>`, `fbt()`, `<fbs>`, and `fbs()` calls
 * in descendant components. The override is transparent — child components
 * require no special imports or call-site changes.
 *
 * If translations for the requested locale are not yet loaded and a `loadLocale`
 * hook has been registered (via `setupLocaleContext`), the component will suspend
 * until translations are available. Wrap in `<Suspense>` to handle the loading state.
 *
 * Note: Like all React context providers, this only affects **child components**,
 * not `fbt`/`fbs` calls in the same component that renders `<FixedLocaleContext>`.
 * Translated content must be in a separate child component:
 *
 * ```tsx
 * // ✓ Correct — child component renders inside the provider
 * <FixedLocaleContext locale="de_DE">
 *   <MyTranslatedComponent />
 * </FixedLocaleContext>
 *
 * // ✗ Won't work — fbt call is evaluated in the parent's render
 * <FixedLocaleContext locale="de_DE">
 *   <fbt desc="greeting">Hello</fbt>
 * </FixedLocaleContext>
 * ```
 */
export default function FixedLocaleContext({
  children,
  gender,
  locale,
}: {
  children: ReactNode;
  gender?: Gender;
  locale: string;
}) {
  useEnsureLocaleLoaded(locale);

  const override = useMemo(
    () => createFixedFbt(locale, gender),
    [gender, locale],
  );
  return (
    <FbtLocaleOverrideContext value={override}>
      {children}
    </FbtLocaleOverrideContext>
  );
}
