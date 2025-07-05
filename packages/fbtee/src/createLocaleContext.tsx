import {
  createContext,
  Context as ReactContext,
  Fragment,
  ReactNode,
  use,
  useActionState,
} from 'react';
import setupLocaleContext, {
  LocaleContextProps,
} from './setupLocaleContext.tsx';

export type LocaleContext = {
  locale: string;
  localeChangeIsPending: boolean;
  setLocale: (locale: string) => void;
};

export const Context = (() =>
  typeof window === 'undefined'
    ? (null as unknown as ReactContext<LocaleContext>)
    : createContext<LocaleContext>(null as unknown as LocaleContext))();

export function useLocaleContext(): LocaleContext {
  return use(Context);
}

export default function createLocaleContext(props: LocaleContextProps) {
  const { getLocale, setLocale } = setupLocaleContext(props);

  return function LocaleContext({ children }: { children: ReactNode }) {
    const [locale, _setLocale, localeChangeIsPending] = useActionState(
      async (previousLocale: string, newLocale: string) => {
        if (newLocale !== previousLocale) {
          return await setLocale(newLocale);
        }
        return newLocale;
      },
      getLocale(),
    );

    return (
      <Context
        value={{
          locale,
          localeChangeIsPending,
          setLocale: _setLocale,
        }}
      >
        <Fragment key={locale}>{children}</Fragment>
      </Context>
    );
  };
}
