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
import Hooks from './Hooks.tsx';
import IntlVariations from './IntlVariations.tsx';
import setupLocaleContext, {
  Gender,
  LocaleContextProps,
  resolveGender,
} from './setupLocaleContext.tsx';

export type LocaleContext = {
  gender: IntlVariations;
  locale: string;
  localeChangeIsPending: boolean;
  setGender: (gender: Gender) => void;
  setLocale: (locale: string) => void;
};

const hasWindow = typeof window !== 'undefined';

export const Context = (() =>
  hasWindow
    ? createContext<LocaleContext>(null as unknown as LocaleContext)
    : ((({ children }: { children: ReactNode }) =>
        children) as unknown as ReactContext<LocaleContext>))();

export const useLocaleContext = (() =>
  hasWindow
    ? () => use(Context)
    : () => {
        const viewerContext = Hooks.getViewerContext();
        return {
          gender: viewerContext.GENDER,
          locale: viewerContext.locale,
          localeChangeIsPending: false,
          setGender: (gender: Gender) => {
            const viewerContext = Hooks.getViewerContext();
            Hooks.register({
              getViewerContext: () => ({
                ...viewerContext,
                GENDER: resolveGender(gender),
              }),
            });
          },
          setLocale: (locale: string) => {
            const viewerContext = Hooks.getViewerContext();
            Hooks.register({
              getViewerContext: () => ({
                ...viewerContext,
                locale,
              }),
            });
          },
        };
      })();

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
