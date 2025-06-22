import { expect, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import LocaleContext, {
  setupLocaleContext,
  TranslationPromise,
  useLocaleContext,
} from '../LocaleContext.tsx';

const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_AT', 'German'],
]);

const hooks = {
  getFbtResult,
} as const;

const Button = () => {
  const { locale, setLocale } = useLocaleContext();
  return <button onClick={() => setLocale('de_AT')}>{locale}</button>;
};

const InvalidLocaleButton = () => {
  const { locale, setLocale } = useLocaleContext();
  return <button onClick={() => setLocale('pirate')}>{locale}</button>;
};

test('locale context allows setting up a full fbtee context', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const { asFragment } = render(
    <LocaleContext
      availableLanguages={availableLanguages}
      clientLocales={['en_US', 'de_AT']}
      fallbackLocale="en_US"
      hooks={hooks}
      loadLocale={loadLocale}
    >
      <Button />
    </LocaleContext>,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       en_US
     </button>
   </DocumentFragment>
  `);

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() =>
    expect(screen.getByRole('button').textContent).toBe('de_AT'),
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       de_AT
     </button>
   </DocumentFragment>
  `);
});

test('locale context does not allow setting invalid locales', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const { asFragment } = render(
    <LocaleContext
      availableLanguages={availableLanguages}
      clientLocales={['en_US']}
      fallbackLocale="en_US"
      hooks={hooks}
      loadLocale={loadLocale}
    >
      <InvalidLocaleButton />
    </LocaleContext>,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() =>
    expect(screen.getByRole('button').textContent).toBe('en_US'),
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       en_US
     </button>
   </DocumentFragment>
  `);
});

test('loading locales mutates the translations object', async () => {
  const { getLocale, setLocale, translations } = setupLocaleContext({
    availableLanguages: new Map([
      ['en_US', 'English'],
      ['de_AT', 'German'],
    ]),
    clientLocales: ['en_US', 'de_AT'],
    loadLocale: jest.fn(
      async (locale: string): TranslationPromise =>
        locale === 'de_AT'
          ? {
              Hey: 'Banane',
            }
          : {},
    ),
  });

  expect(translations).toMatchInlineSnapshot(`
   {
     "en_US": {},
   }
  `);

  await setLocale('de_AT');

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
