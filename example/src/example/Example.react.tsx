import classNames from 'classnames';
import { fbs, fbt, GenderConst, init, IntlVariations } from 'fbt';
import { ChangeEvent, useCallback, useState } from 'react';
import * as React from 'react';
import translations from '../translatedFbts.json';
import ExampleEnum from './Example$FbtEnum';

const viewerContext = {
  GENDER: IntlVariations.GENDER_UNKNOWN,
  locale: 'en_US',
};

init({
  translations,
  hooks: {
    getViewerContext: () => viewerContext,
  },
});

const LOCALES = {
  en_US: {
    bcp47: 'en-US',
    displayName: 'English (US)\u200e',
    englishName: 'English (US)',
    rtl: false,
  },
  fb_HX: {
    bcp47: 'fb-HX',
    displayName: 'l33t 5p34k',
    englishName: 'FB H4x0r',
    rtl: false,
  },
  es_LA: {
    bcp47: 'es-419',
    displayName: 'Espa\u00F1ol',
    englishName: 'Spanish',
    rtl: false,
  },
  ar_AR: {
    bcp47: 'ar',
    displayName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629',
    englishName: 'Arabic',
    rtl: true,
  },
  he_IL: {
    bcp47: 'he',
    displayName: '\u05E2\u05D1\u05E8\u05D9\u05EA',
    englishName: 'Hebrew',
    rtl: true,
  },
  ja_JP: {
    bcp47: 'ja',
    displayName: '\u65E5\u672C\u8A9E',
    englishName: 'Japanese',
    rtl: false,
  },
  ru_RU: {
    bcp47: 'ru',
    displayName: 'Русский',
    englishName: 'Russian',
    rtl: false,
  },
} as const;

type Locale = keyof typeof LOCALES;
type SharedObj = keyof typeof ExampleEnum;

export default function Example() {
  const [locale, setLocale] = useState<Locale>('en_US');
  const [ex1Name, setEx1Name] = useState('Someone');
  const [ex1Gender, setEx1Gender] = useState(IntlVariations.GENDER_UNKNOWN);
  const [ex1Count, setEx1Count] = useState(1);
  const [ex2Name, setEx2Name] = useState('Someone');
  const [ex2Object, setEx2Object] = useState<SharedObj>('LINK');
  const [ex2Pronoun, setEx2Pronoun] = useState(GenderConst.UNKNOWN_SINGULAR);

  const updateLocale = useCallback((newLocale: Locale) => {
    viewerContext.locale = newLocale;
    setLocale(newLocale);
    const html = document.getElementsByTagName('html')[0];
    if (html != null) {
      html.lang = LOCALES[newLocale].bcp47;
    }
    document.body.className = LOCALES[newLocale].rtl ? 'rtl' : 'ltr';
  }, []);

  const onSubmit = useCallback((event: ChangeEvent<HTMLFormElement>) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  return (
    <div>
      <div className="example">
        <div className="warning">
          <fbt desc="title">Your FBT Demo</fbt>
        </div>
        <h1>
          <fbt desc="header">Construct sentences</fbt>
        </h1>
        <h2>
          {/* For fbt common strings, the description will be sourced from an external manifest.
            See `--fbt-common-path` option from `fbt-collect` and common_strings.json */}
          <fbt common>Use the form below to see FBT in action.</fbt>
        </h2>
        <form action="" method="get" onSubmit={onSubmit}>
          <fieldset>
            <span className="example_row">
              <span className="example_input--30">
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const vcGender = parseInt(event.target.value, 10);
                    viewerContext.GENDER = vcGender;
                  }}
                >
                  <option value={IntlVariations.GENDER_UNKNOWN}>
                    <fbt desc="Gender Select label">Your Gender:</fbt>
                  </option>
                  <option value={IntlVariations.GENDER_UNKNOWN}>
                    <fbt desc="Unknown gender">Unknown</fbt>
                  </option>
                  <option value={IntlVariations.GENDER_MALE}>
                    <fbt desc="Male gender">Male</fbt>
                  </option>
                  <option value={IntlVariations.GENDER_FEMALE}>
                    <fbt desc="Female gender">Female</fbt>
                  </option>
                </select>
              </span>
            </span>
          </fieldset>

          <fieldset>
            <span className={classNames('example_row', 'example_row--multi')}>
              <span
                className={classNames('example_input', 'example_input--40')}
              >
                <input
                  name="name"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setEx1Name(event.target.value);
                  }}
                  placeholder={fbs('name', 'name field')}
                  type="text"
                />
              </span>
              <span
                className={classNames('example_input', 'example_input--30')}
              >
                <input
                  name="count"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const val = parseInt(event.target.value, 10);
                    setEx1Count(isNaN(val) ? 1 : val);
                  }}
                  placeholder={fbs('count', 'count field')}
                  type="number"
                />
              </span>
              <span className="example_row">
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setEx1Gender(parseInt(event.target.value, 10));
                  }}
                >
                  <option value={IntlVariations.GENDER_UNKNOWN}>
                    <fbs desc="Gender Select label">Gender:</fbs>
                  </option>
                  <option value={IntlVariations.GENDER_UNKNOWN}>
                    <fbs desc="Unknown gender">Unknown</fbs>
                  </option>
                  <option value={IntlVariations.GENDER_MALE}>
                    <fbs desc="Male gender">Male</fbs>
                  </option>
                  <option value={IntlVariations.GENDER_FEMALE}>
                    <fbs desc="Female gender">Female</fbs>
                  </option>
                </select>
              </span>
            </span>
          </fieldset>

          <fieldset>
            <span className="sentence example_row">
              <fbt desc="example 1">
                <fbt:param gender={ex1Gender} name="name">
                  <b className="padRight">{ex1Name}</b>
                </fbt:param>
                has shared
                <a className="neatoLink" href="#">
                  <fbt:plural count={ex1Count} many="photos" showCount="ifMany">
                    a photo
                  </fbt:plural>
                </a>
                with you
              </fbt>
            </span>
          </fieldset>

          <fieldset>
            <span className={classNames('example_row', 'example_row--multi')}>
              <span
                className={classNames('example_input', 'example_input--40')}
              >
                <input
                  name="ex2Name"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setEx2Name(event.target.value);
                  }}
                  placeholder={fbs('name', 'name field')}
                  type="text"
                />
              </span>
              <span
                className={classNames('example_input', 'example_input--20')}
              >
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setEx2Object(
                      event.target.value as keyof typeof ExampleEnum
                    );
                  }}
                >
                  {Object.keys(ExampleEnum).map((k) => (
                    <option key={k} value={k}>
                      {ExampleEnum[k as keyof typeof ExampleEnum]}
                    </option>
                  ))}
                </select>
              </span>
              <span className={classNames('example_row', 'example_input--20')}>
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setEx2Pronoun(parseInt(event.target.value, 10));
                  }}
                >
                  <option value={GenderConst.UNKNOWN_PLURAL}>
                    <fbs desc="Gender Select label">Gender:</fbs>
                  </option>
                  <option value={GenderConst.NOT_A_PERSON}>
                    <fbs desc="Gender Select label">Not a person</fbs>
                  </option>
                  <option value={GenderConst.UNKNOWN_PLURAL}>
                    <fbs desc="Gender Select label">Unknown (Plural)</fbs>
                  </option>
                  <option value={GenderConst.UNKNOWN_SINGULAR}>
                    <fbs desc="Gender Select label">Unknown (singular)</fbs>
                  </option>
                  <option value={GenderConst.MALE_SINGULAR}>
                    <fbs desc="Gender Select label">Male (singular)</fbs>
                  </option>
                  <option value={GenderConst.FEMALE_SINGULAR}>
                    <fbs desc="Gender Select label">Female (singular)</fbs>
                  </option>
                </select>
              </span>
            </span>
          </fieldset>
          <fieldset>
            <span className="sentence example_row">
              <fbt desc="Example enum & pronoun">
                <fbt:param name="name">
                  <b className="padRight">
                    <a href="#">{ex2Name}</a>
                  </b>
                </fbt:param>
                has a
                <fbt:enum enum-range={ExampleEnum} value={ex2Object} />
                to share!{' '}
                <b className="pad">
                  <a href="#">View</a>
                </b>{' '}
                <fbt:pronoun
                  gender={ex2Pronoun}
                  human={false}
                  type="possessive"
                />{' '}
                <fbt:enum enum-range={ExampleEnum} value={ex2Object} />.
              </fbt>
            </span>
          </fieldset>
          <fieldset>
            <span className="example_row">
              <button
                className="bottom"
                onClick={(e) => {
                  window.open('https://github.com/facebook/fbt', '_blank');
                }}
                type="submit"
              >
                {fbt('Try it out!', 'Sign up button')}
              </button>
            </span>
          </fieldset>
        </form>
      </div>
      <ul className="languages">
        {Object.keys(LOCALES).map((loc) => (
          <li key={loc}>
            {locale === loc ? (
              LOCALES[loc].displayName
            ) : (
              <a
                href={`#${loc}`}
                onClick={(event: React.UIEvent) => {
                  event.preventDefault();
                  updateLocale(loc as keyof typeof LOCALES);
                }}
              >
                {LOCALES[loc as keyof typeof LOCALES].displayName}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="copyright">{`Facebook \u00A9 2021`}</p>
    </div>
  );
}
