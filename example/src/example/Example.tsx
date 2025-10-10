import { VStack } from '@nkzw/stack';
import classNames from 'classnames';
import { fbs, fbt, GenderConst, IntlVariations, setupFbtee } from 'fbtee';
import { ChangeEvent, useCallback, useState } from 'react';
import ar_AR from '../translatedFbts/ar_AR.json' with { type: 'json' };
import de_DE from '../translatedFbts/de_DE.json' with { type: 'json' };
import es_LA from '../translatedFbts/es_LA.json' with { type: 'json' };
import fb_HX from '../translatedFbts/fb_HX.json' with { type: 'json' };
import fr_FR from '../translatedFbts/fr_FR.json' with { type: 'json' };
import he_IL from '../translatedFbts/he_IL.json' with { type: 'json' };
import it_IT from '../translatedFbts/it_IT.json' with { type: 'json' };
import ja_JP from '../translatedFbts/ja_JP.json' with { type: 'json' };
import ExampleEnum from './Example$FbtEnum.ts';
import Locales, { Locale } from './Locales.tsx';

const translations = {
  ar_AR: ar_AR.ar_AR,
  de_DE: de_DE.de_DE,
  es_LA: es_LA.es_LA,
  fb_HX: fb_HX.fb_HX,
  fr_FR: fr_FR.fr_FR,
  he_IL: he_IL.he_IL,
  it_IT: it_IT.it_IT,
  ja_JP: ja_JP.ja_JP,
};

let viewerContext = {
  GENDER: IntlVariations.GENDER_UNKNOWN,
  locale: 'en_US',
};

setupFbtee({
  hooks: {
    getViewerContext: () => viewerContext,
  },
  translations,
});

type SharedObj = keyof typeof ExampleEnum;

export default function Example() {
  const [locale, setLocale] = useState<Locale>('en_US');
  const [ex1Name, setEx1Name] = useState('Someone');
  const [ex1Gender, setEx1Gender] = useState(IntlVariations.GENDER_UNKNOWN);
  const [ex1Count, setEx1Count] = useState(1);
  const [ex2Name, setEx2Name] = useState('Someone');
  const [ex2Object, setEx2Object] = useState<SharedObj>('LINK');
  const [ex2Pronoun, setEx2Pronoun] = useState(GenderConst.UNKNOWN_SINGULAR);

  const updateLocale = useCallback((locale: Locale) => {
    viewerContext = {
      ...viewerContext,
      locale,
    };
    setLocale(locale);
    const html = document.getElementsByTagName('html')[0];
    if (html != null) {
      html.lang = Locales[locale].bcp47;
    }
    document.body.className = Locales[locale].rtl ? 'rtl' : 'ltr';
  }, []);

  const onSubmit = useCallback((event: ChangeEvent<HTMLFormElement>) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  return (
    <div>
      <div className="example">
        <div className="headline">
          <>
            <fbt desc="title">
              <b>fbtee </b> Demo
            </fbt>
          </>
        </div>
        <h1>
          <fbt desc="header">Sentence Examples</fbt>
        </h1>
        <h2>
          {/* For fbt common strings, the description will be sourced from an external manifest.
            See `--common` option from `fbtee collect` and common_strings.json */}
          <fbt common>Use the form below to see fbtee in action.</fbt>
        </h2>
        <VStack action="" as="form" gap method="get" onSubmit={onSubmit}>
          <fieldset>
            <span className="example_row">
              <span className="example_input--30">
                <select
                  className="neatoSelect"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const vcGender = Number.parseInt(event.target.value, 10);
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
                Do you want to share{' '}
                <fbt:list
                  conjunction="or"
                  items={[
                    <fbt desc="Item in a list." key="photo">
                      a photo
                    </fbt>,
                    <fbt desc="Item in a list." key="photo">
                      a link
                    </fbt>,
                    <fbt desc="Item in a list." key="video">
                      a video
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
                onClick={() => window.open('https://fbtee.dev', '_blank')}
                type="submit"
              >
                {fbt('Try it out!', 'Sign up button')}
              </button>
            </span>
          </fieldset>
        </VStack>
      </div>
      <ul className="languages">
        {Object.keys(Locales).map((loc) => (
          <li key={loc}>
            {locale === loc ? (
              Locales[loc].displayName
            ) : (
              <a
                href={`#${loc}`}
                onClick={(event: React.UIEvent) => {
                  event.preventDefault();
                  updateLocale(loc as keyof typeof Locales);
                }}
              >
                {Locales[loc as keyof typeof Locales].displayName}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
