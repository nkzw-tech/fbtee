import { createFbteeRuntime, fbs, LocaleProvider, useFbt } from 'fbtee';
import { useState } from 'react';
import ar from '../translatedFbts/ar.json' with { type: 'json' };
import deDE from '../translatedFbts/de-DE.json' with { type: 'json' };
import es419 from '../translatedFbts/es-419.json' with { type: 'json' };
import fbHX from '../translatedFbts/fb-HX.json' with { type: 'json' };
import frFR from '../translatedFbts/fr-FR.json' with { type: 'json' };
import heIL from '../translatedFbts/he-IL.json' with { type: 'json' };
import itIT from '../translatedFbts/it-IT.json' with { type: 'json' };
import jaJP from '../translatedFbts/ja-JP.json' with { type: 'json' };
import ruRU from '../translatedFbts/ru-RU.json' with { type: 'json' };
import Locales, { getLocaleDirection, Locale } from './Locales.tsx';
import scopedSave from './scopedSave.tsx';

const translations = {
  ...ar,
  ...deDE,
  ...es419,
  ...fbHX,
  ...frFR,
  ...heIL,
  ...itIT,
  ...jaJP,
  ...ruRU,
};
const locales = Object.keys(Locales) as Array<Locale>;
const runtimes = new Map(
  locales.map((locale) => [locale, createFbteeRuntime({ locale, translations })]),
);

function SavePreview() {
  const { fbt, locale } = useFbt();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<{ locale: string; message: string } | null>(null);

  return (
    <>
      <p>
        <fbt desc="Scoped demo formatted amount">
          Total:{' '}
          <fbt:param name="amount" number>
            {1234.5}
          </fbt:param>
        </fbt>
      </p>
      <button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const message = await scopedSave(fbt, 1234.5);
            setSaved({ locale, message: String(message) });
          } finally {
            setPending(false);
          }
        }}
        type="button"
      >
        {pending
          ? fbt('Saving…', 'Scoped demo pending action')
          : fbt('Save', 'Scoped demo save button')}
      </button>
      {saved && (
        <output aria-live="polite" lang={saved.locale}>
          <>
            {saved.message} <small lang="en">{saved.locale}</small>
          </>
        </output>
      )}
    </>
  );
}

function Widget({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  return (
    <div
      className="scoped-widget"
      dir={getLocaleDirection(Locales[locale].bcp47)}
      lang={Locales[locale].bcp47}
    >
      <select
        aria-label={fbs('Preview language', 'Scoped demo locale selector')}
        onChange={(event) => setLocale(event.target.value as Locale)}
        value={locale}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {Locales[locale].displayName}
          </option>
        ))}
      </select>
      <LocaleProvider runtime={runtimes.get(locale)!}>
        <SavePreview />
      </LocaleProvider>
    </div>
  );
}

export default function ScopedLocaleExample() {
  return (
    <section className="scoped-example">
      <h2>
        <fbt desc="Scoped demo heading">Independent locales</fbt>
      </h2>
      <p>
        <fbt desc="Scoped demo instructions">
          Render components that use a different locale from the rest of the page.
        </fbt>
      </p>
      <div className="scoped-widgets">
        <Widget initialLocale="de_DE" />
        <Widget initialLocale="ja_JP" />
      </div>
    </section>
  );
}
