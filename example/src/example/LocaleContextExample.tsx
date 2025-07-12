import { VStack } from '@nkzw/stack';
import classNames from 'classnames';
import {
  createLocaleContext,
  fbs,
  fbt,
  GenderConst,
  IntlVariations,
  useLocaleContext,
} from 'fbtee';
import {
  ChangeEvent,
  StrictMode,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import translations from '../translatedFbts.json' with { type: 'json' };
import ExampleEnum from './Example$FbtEnum.ts';
import Locales, { Locale } from './Locales.tsx';

type SharedObj = keyof typeof ExampleEnum;
type LocaleKey = keyof typeof Locales;

const Example = () => {
  const [, startTransition] = useTransition();
  const { locale, localeChangeIsPending, setLocale } = useLocaleContext();
  const [newLocale, setNewLocale] = useState(locale);
  const [ex1Name, setEx1Name] = useState('Someone');
  const [ex1Gender, setEx1Gender] = useState(IntlVariations.GENDER_UNKNOWN);
  const [ex1Count, setEx1Count] = useState(1);
  const [ex2Name, setEx2Name] = useState('Someone');
  const [ex2Object, setEx2Object] = useState<SharedObj>('LINK');
  const [ex2Pronoun, setEx2Pronoun] = useState(GenderConst.UNKNOWN_SINGULAR);

  const updateLocale = useCallback(
    async (locale: Locale) => {
      setNewLocale(locale);
      startTransition(() => {
        setLocale(locale);
      });
    },
    [setLocale],
  );

  useEffect(() => {
    if (locale && !localeChangeIsPending) {
      const html = document.getElementsByTagName('html')[0]!;
      html.lang = Locales[locale as LocaleKey].bcp47;
      document.body.className = Locales[locale as LocaleKey].rtl
        ? 'rtl'
        : 'ltr';
    }
  }, [locale, localeChangeIsPending]);

  const highlightedLocale = localeChangeIsPending ? newLocale : locale;

  const onSubmit = useCallback((event: ChangeEvent<HTMLFormElement>) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  return (
    <div>
      <VStack className="example" gap>
        <div className="warning">
          <fbt desc="title">Your FBT Demo</fbt>
        </div>
        <h1>
          <fbt desc="header">Construct sentences</fbt>
        </h1>
        <h2>
          {/* For fbt common strings, the description will be sourced from an external manifest.
            See `--common` option from `fbtee collect` and common_strings.json */}
          <fbt common>Use the form below to see FBT in action.</fbt>
        </h2>
        <VStack action="" as="form" gap method="get" onSubmit={onSubmit}>
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
                    const val = Number.parseInt(event.target.value, 10);
                    setEx1Count(Number.isNaN(val) ? 1 : val);
                  }}
                  placeholder={fbs('count', 'count field')}
                  type="number"
                />
              </span>
              <span className="example_row">
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setEx1Gender(Number.parseInt(event.target.value, 10));
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
                      event.target.value as keyof typeof ExampleEnum,
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
                    setEx2Pronoun(Number.parseInt(event.target.value, 10));
                  }}
                >
                  <option value={GenderConst.UNKNOWN_PLURAL}>
                    <fbs desc="Gender Select label">Gender:</fbs>
                  </option>
                  <option value={GenderConst.NOT_A_PERSON}>
                    <fbs desc="Gender Select label">Not a person</fbs>
                  </option>
                  <option value={GenderConst.UNKNOWN_PLURAL}>
                    <fbs desc="Gender Select label">Unknown (plural)</fbs>
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
            <label>
              <fbt desc="List example.">
                Do you want to share a{' '}
                <fbt:list
                  conjunction="or"
                  items={[
                    <fbt desc="Item in a list." key="photo">
                      photo
                    </fbt>,
                    <fbt desc="Item in a list." key="photo">
                      link
                    </fbt>,
                    <fbt desc="Item in a list." key="video">
                      video
                    </fbt>,
                  ]}
                  name="list"
                />?
              </fbt>
            </label>
          </fieldset>
          <fieldset>
            <span className="example_row">
              <button
                className="bottom"
                onClick={(e) => {
                  window.open('https://github.com/nkzw-tech/fbtee', '_blank');
                }}
                type="submit"
              >
                {fbt('Try it out!', 'Sign up button')}
              </button>
            </span>
          </fieldset>
        </VStack>
      </VStack>
      <ul className="languages">
        {Object.keys(Locales).map((loc) => (
          <li key={loc}>
            {highlightedLocale === loc ? (
              Locales[loc as LocaleKey].displayName
            ) : (
              <a
                href={`#${loc}`}
                onClick={(event: React.UIEvent) => {
                  event.preventDefault();
                  updateLocale(loc as LocaleKey);
                }}
              >
                {Locales[loc as LocaleKey].displayName}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const LocaleContext = createLocaleContext({
  availableLanguages: new Map(
    Object.keys(Locales).map(
      (locale) => [locale, Locales[locale as LocaleKey].displayName] as const,
    ),
  ),
  clientLocales: [...navigator.languages, navigator.language],
  loadLocale: () => Promise.resolve({}),
  translations,
});

export default function Root() {
  return (
    <StrictMode>
      <LocaleContext>
        <Example />
      </LocaleContext>
    </StrictMode>
  );
}
