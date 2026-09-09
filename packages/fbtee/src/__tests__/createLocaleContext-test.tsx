import { expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTransition } from 'react';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import createLocaleContext, { useLocaleContext } from '../createLocaleContext.tsx';
import fbtInternal from '../fbt.tsx';
import setupLocaleContext, { LocaleLoaderFn, TranslationPromise } from '../setupLocaleContext.tsx';

const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_AT', 'German'],
]);

const hooks = {
  getFbtResult,
} as const;

const Button = () => {
  const [, startTransition] = useTransition();
  const { locale, setLocale } = useLocaleContext();
  return (
    <button onClick={() => startTransition(() => setLocale('de_AT'))} type="button">
      {locale}
    </button>
  );
};

const GenderButton = () => {
  const { gender, setGender } = useLocaleContext();
  return (
    <button onClick={() => setGender('female')} type="button">
      {gender}
    </button>
  );
};

const InvalidLocaleButton = () => {
  const [, startTransition] = useTransition();
  const { locale, setLocale } = useLocaleContext();
  return (
    <button onClick={() => startTransition(() => setLocale('pirate'))} type="button">
      {locale}
    </button>
  );
};

test.each([false, true])(
  'rendering without preload keeps the existing behavior (supplied translations: %s)',
  async (supplied) => {
    const loadLocale = jest.fn<LocaleLoaderFn>(async () => ({ greeting: 'Hallo' }));
    const LocaleContext = createLocaleContext({
      availableLanguages,
      clientLocales: ['de-AT'],
      hooks,
      loadLocale,
      translations: supplied ? { de_AT: { greeting: 'Hallo' } } : undefined,
    });

    const Greeting = () => {
      const { locale } = useLocaleContext();
      return <p lang={locale}>{String(fbtInternal._('Hello', null, { hk: 'greeting' }))}</p>;
    };

    await act(async () => {
      render(
        <LocaleContext>
          <Greeting />
        </LocaleContext>,
      );
    });

    expect(screen.getByText(supplied ? 'Hallo' : 'Hello').lang).toBe('de_AT');
    expect(loadLocale).not.toHaveBeenCalled();
  },
);

test('preloading the detected locale translates the first render', async () => {
  const loadLocale = jest.fn<LocaleLoaderFn>(async () => ({ greeting: 'Hallo' }));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['de-AT'],
    hooks,
    loadLocale,
  });

  expect(loadLocale).not.toHaveBeenCalled();
  await LocaleContext.preload();
  await LocaleContext.preload();
  expect(loadLocale).toHaveBeenCalledTimes(1);
  expect(loadLocale).toHaveBeenCalledWith('de_AT');

  const Greeting = () => {
    const { locale } = useLocaleContext();
    return <p lang={locale}>{String(fbtInternal._('Hello', null, { hk: 'greeting' }))}</p>;
  };

  render(
    <LocaleContext>
      <Greeting />
    </LocaleContext>,
  );
  expect(screen.getByText('Hallo').lang).toBe('de_AT');
});

test('locale context allows setting up a full fbtee context', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US', 'de_AT'],
    fallbackLocale: 'en_US',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <Button />
    </LocaleContext>,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button
    type="button"
  >
    en_US
  </button>
</DocumentFragment>
`);

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('de_AT'));

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button
    type="button"
  >
    de_AT
  </button>
</DocumentFragment>
`);
});

test('locale context does not allow setting invalid locales', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US'],
    fallbackLocale: 'en_US',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <InvalidLocaleButton />
    </LocaleContext>,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('en_US'));

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button
    type="button"
  >
    en_US
  </button>
</DocumentFragment>
`);
});

test('loading locales mutates the translations object', async () => {
  const translations = { en_US: {} };
  const { getLocale, setLocale } = setupLocaleContext({
    availableLanguages: new Map([
      ['en_US', 'English'],
      ['de_AT', 'German'],
    ]),
    clientLocales: ['en_US', 'de_AT'],
    loadLocale: jest.fn(async (locale: string): TranslationPromise =>
      locale === 'de_AT'
        ? {
            Hey: 'Banane',
          }
        : {},
    ),
    translations,
  });

  expect(translations).toMatchInlineSnapshot(`
   {
     "en_US": {},
   }
  `);

  await act(async () => {
    await setLocale('de_AT');
  });

  expect(getLocale()).toBe('de_AT');
  expect(translations).toMatchInlineSnapshot(`
   {
     "de_AT": {
       "Hey": "Banane",
     },
     "en_US": {},
   }
  `);
});

test('locale context resolves BCP 47 aliases to existing legacy locales', async () => {
  const translations = { en_US: {} };
  const { getLocale, setLocale } = setupLocaleContext({
    availableLanguages: new Map([
      ['en_US', 'English'],
      ['de_AT', 'German'],
    ]),
    clientLocales: ['en-US'],
    loadLocale: jest.fn(async (locale: string): TranslationPromise => {
      expect(locale).toBe('de_AT');
      return {};
    }),
    translations,
  });

  expect(getLocale()).toBe('en_US');
  await act(async () => {
    await setLocale('de-AT');
  });
  expect(getLocale()).toBe('de_AT');
});

test('the gender can be changed', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US', 'de_AT'],
    gender: 'unknown',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <GenderButton />
    </LocaleContext>,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button
    type="button"
  >
    3
  </button>
</DocumentFragment>
`);

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('2'));

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button
    type="button"
  >
    2
  </button>
</DocumentFragment>
`);
});
