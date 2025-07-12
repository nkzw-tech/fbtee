import {
  createContext,
  Fragment,
  Context as ReactContext,
  ReactNode,
  use,
  useActionState,
  useCallback,
  useState,
} from 'react';
import IntlVariations from './IntlVariations.tsx';
import setupLocaleContext, {
  Gender,
  LocaleContextProps,
} from './setupLocaleContext.tsx';

export type LocaleContext = {
  gender: IntlVariations;
  locale: string;
  localeChangeIsPending: boolean;
  setGender: (gender: Gender) => void;
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
  const {
    gender: initialGender,
    getLocale,
    setGender,
    setLocale,
  } = setupLocaleContext(props);

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

    const [gender, _setGender] = useState(initialGender);
    const changeGender = useCallback(
      (newGender: Gender) => {
        if (newGender !== gender) {
          const gender = setGender(newGender);
          _setGender(gender);
        }
        return newGender;
      },
      [gender],
    );

    return (
      <Context
        value={{
          gender,
          locale,
          localeChangeIsPending,
          setGender: changeGender,
          setLocale: _setLocale,
        }}
      >
        <Fragment key={`${locale}-${gender}`}>{children}</Fragment>
      </Context>
    );
  };
}
