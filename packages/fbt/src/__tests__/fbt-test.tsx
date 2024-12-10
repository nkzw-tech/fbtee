/// <reference types="../ReactTypes.d.ts" />

import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { Children, Component } from 'react';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import fbtInternal from '../fbt.tsx';
import FbtHooks, {
  FbtResolvedPayload,
  FbtRuntimeCallInput,
  FbtTranslatedInput,
} from '../FbtHooks.tsx';
import init from '../fbtInit.tsx';
import FbtResult from '../FbtResult.tsx';
import FbtTranslations from '../FbtTranslations.tsx';
import GenderConst from '../GenderConst.tsx';
import { fbt } from '../index.tsx';
import IntlVariations from '../IntlVariations.tsx';
import { IFbtErrorListener, IFbtResultBase } from '../Types.tsx';

init({
  translations: { en_US: {} },
});

describe('fbt', () => {
  beforeEach(() => {
    FbtHooks.register({
      getFbtResult,
      getTranslatedInput: FbtTranslations.getTranslatedInput,
    });
  });

  it('should memoize new strings', () => {
    expect(fbtInternal._getCachedFbt('sample string')).toEqual(undefined);

    expect(fbtInternal._('sample string')).toEqual(
      fbtInternal._getCachedFbt('sample string')
    );
  });

  it('should trivially handle tokenless strings', () => {
    expect(fbt('without tokens', 'test')).toEqual('without tokens');
  });

  it('should handle common strings', () => {
    expect(fbt.c('Accept')).toEqual(
      fbt('Accept', 'Button/Link: Accept conditions')
    );
  });

  it('should replace tokens with named values', () => {
    expect(
      fbt('with token ' + fbt.param('token', 'A') + ' here', 'test')
    ).toEqual('with token A here');
    expect(
      fbt(
        'with tokens ' +
          fbt.param('tokenA', 'A') +
          ' and ' +
          fbt.param('tokenB', 'B') +
          '',
        'test'
      )
    ).toEqual('with tokens A and B');
  });

  it('should remove punctuation when a value ends with it', () => {
    expect(fbt('Play ' + fbt.param('game', 'Chess!') + '!', 'test')).toEqual(
      'Play Chess!'
    );
    expect(
      fbt("What's on your mind " + fbt.param('name', 'T.J.') + '?', 'test')
    ).toEqual("What's on your mind T.J.?");
  });

  it('should allow values that look like token patterns', () => {
    expect(
      fbt(
        'with tokens ' +
          fbt.param('tokenA', '{tokenB}') +
          ' and ' +
          fbt.param('tokenB', 'B') +
          '',
        'test'
      )
    ).toEqual('with tokens {tokenB} and B');
  });

  it('should support objects as token values', () => {
    // We expect that this returns an opaque React fragment instead of an array.
    // We use this to preserve identity of nested React elements.
    const argument = <div />;
    const fragment = fbt(
      'with token ' + fbt.param('token', argument) + ' here',
      'test'
    );
    const items: Array<string | IFbtResultBase> = [];
    Children.forEach(fragment, (item) => {
      items.push(item);
    });
    expect(items).toEqual(['with token ', argument, ' here']);
  });

  it('should render empty string for null values', () => {
    expect(fbt(fbt.param('null_value', null), 'test')).toEqual('');
  });

  it('should render empty string for undefined values', () => {
    expect(fbt(fbt.param('undefined_value', undefined), 'test')).toEqual('');
  });

  // React/fbt integration tests
  type Props = Readonly<{
    childA: React.ReactNode;
    childB: React.ReactNode;
    value: string;
  }>;

  function _render(
    value: string,
    childA: React.ReactNode,
    childB: React.ReactNode
  ) {
    // In theory, different enum values can result in different sentence
    // structures. If that happens, the React components should retain
    // their state even though they change order. We mock out a fake
    // string table to test this special case.
    const fbtFragment = fbtInternal._(
      {
        A: 'preamble {tokenA} is before {tokenB}',
        B: 'preamble {tokenB} is after {tokenA}',
      },
      [
        fbtInternal._param('tokenA', childA),
        fbtInternal._param('tokenB', childB),
        fbtInternal._enum(value, { A: 'is before', B: 'is after' }),
      ]
    );
    // @ts-expect-error
    return <div>{fbtFragment}</div>;
  }

  class TestComponent extends Component<Props> {
    override render() {
      return _render(this.props.value, this.props.childA, this.props.childB);
    }
  }

  it('should use wildcard defaults', () => {
    expect(
      fbt(
        'with something like ' +
          fbt.param('count', 42, { number: true }) +
          ' wildcards',
        'test'
      )
    ).toEqual('with something like 42 wildcards');
  });

  it('should format numeric value', () => {
    expect(
      fbt(
        'A total amount is ' + fbt.param('count', 10_000, { number: true }),
        'Test string'
      )
    ).toEqual('A total amount is 10,000');
  });

  it('should keep literal value as is', () => {
    expect(
      fbt('A total amount is ' + fbt.param('count', 10_000), 'Test string')
    ).toEqual('A total amount is 10000');
  });

  it('should not warn when unkeyed React components are params', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <TestComponent childA={<div />} childB={<div />} value="A" />
    );
    expect(container.children[0].getElementsByTagName('div').length).toBe(2);
    expect(warn.mock.calls.length).toBe(0);
  });

  function expectChildSetsToRetainIdentity(
    setA: React.ReactElement,
    setB: React.ReactElement
  ) {
    const { container: containerA } = render(
      <TestComponent childA={setA} childB={setB} value="A" />
    );
    const nodeA = containerA.children[0];
    const { container: containerB } = render(
      <TestComponent childA={setA} childB={setB} value="B" />
    );
    const nodeB = containerB.children[0];

    expect(nodeA.getElementsByTagName('div').length).toBe(2);
    expect(nodeB.getElementsByTagName('div').length).toBe(2);

    // Expect the child nodes be the same instances as before, only reordered.
    expect(nodeA.children[0].innerHTML).toBe(nodeB.children[1].innerHTML);
    expect(nodeA.children[1].innerHTML).toBe(nodeB.children[0].innerHTML);
  }

  it('should retain React identity when sentence order changes', () => {
    expectChildSetsToRetainIdentity(<div key="A" />, <div key="B" />);
  });

  // TODO: Allow keyed React components to use their key as the param name,
  // or transfer the param name to the React key if one is not provided.

  // it('should retain React identity with implicit keys', function() {
  //   expectChildSetsToRetainIdentity(<div />, <div />);
  // });

  // it('should retain React identity of sets when order changes', function() {
  //   expectChildSetsToRetainIdentity(
  //     [<div key="foo" />, <span key="bar" />],
  //     [<div key="foo" />, <span key="bar" />]
  //   );
  // });

  describe('when encountering duplicate token substitutions', () => {
    it('should log the duplicate token coming from the same type of construct', () => {
      expect(() =>
        fbtInternal._('Just a {tokenName}', [
          fbtInternal._param('tokenName', 'substitute'),
          fbtInternal._param('tokenName', 'substitute'),
        ])
      ).toThrowErrorMatchingInlineSnapshot(
        `"Cannot register a substitution with token=\`tokenName\` more than once"`
      );
    });

    it('should log the duplicate token coming from the different constructs', () => {
      expect(() =>
        fbtInternal._('Just a {tokenName}', [
          fbtInternal._param('tokenName', 'substitute'),
          fbtInternal._name(
            'tokenName',
            'person name',
            GenderConst.UNKNOWN_SINGULAR
          ),
        ])
      ).toThrowErrorMatchingInlineSnapshot(
        `"Cannot register a substitution with token=\`tokenName\` more than once"`
      );
    });
  });

  describe('when encountering missing params for token substitutions', () => {
    it('should invoke onMissingParameterError error listener', () => {
      const onMissingParameterError = jest.fn();
      const errorListener = jest
        .fn<() => IFbtErrorListener | null | undefined>()
        .mockImplementation(() => ({
          onMissingParameterError,
        }));
      FbtHooks.register({
        errorListener,
      });
      const pattern = 'Just a {tokenName}';
      fbtInternal._(pattern, []);
      expect(errorListener).toHaveBeenLastCalledWith({
        translation: pattern,
      });
      expect(onMissingParameterError).toHaveBeenCalledWith([], 'tokenName');
    });
  });

  it('should create a tuple for fbt.subject if valid', () => {
    expect(fbtInternal._subject(GenderConst.MALE_SINGULAR)).toEqual([
      [GenderConst.MALE_SINGULAR, '*'],
      null,
    ]);
    expect(() => fbtInternal._subject(0)).toThrow('Invalid gender provided');
  });

  it('should leave non-QuickTranslation strings alone', () => {
    expect(
      fbtInternal._(["This isn't", '8b0c31a270a324f26d2417a358106612'])
    ).toEqual("This isn't");
  });

  it('should access table with multiple tokens containing subject', () => {
    expect(
      fbt(
        'Invited by ' + fbt.plural('friend', 1, { showCount: 'yes' }) + '.',
        'Test Description',
        { subject: IntlVariations.GENDER_UNKNOWN }
      )
    ).toEqual('Invited by 1 friend.');
  });

  it('should defer to FbtHooks.getTranslatedInput', () => {
    FbtHooks.register({
      getTranslatedInput(_input: FbtRuntimeCallInput): FbtTranslatedInput {
        return { args: null, table: 'ALL YOUR TRANSLATION ARE BELONG TO US' };
      },
    });
    expect(fbtInternal._('sample string', null, null)).toEqual(
      'ALL YOUR TRANSLATION ARE BELONG TO US'
    );
  });

  it('should pass extra options to FbtHooks.getFbtResult', () => {
    FbtHooks.register({
      getFbtResult(input: FbtResolvedPayload) {
        const { extraOptions } = input;
        const string = FbtResult.get(input).toString();
        if (extraOptions?.renderStringInBracket === 'yes') {
          return new FbtResult([`[${string}]`], input.errorListener);
        }
        return new FbtResult([string], input.errorListener);
      },
    });
    expect(fbtInternal._('A simple string', null)._contents[0]).toEqual(
      'A simple string'
    );
    expect(
      fbtInternal._('Another simple string', null, {
        eo: { renderStringInBracket: 'yes' },
      })._contents[0]
    ).toEqual('[Another simple string]');
  });

  describe('given a string that is only made of contiguous tokens', () => {
    it('should return a list of token values without empty strings', () => {
      const fbtParams = ['hello', 'world'];

      expect(
        <fbt desc="...">
          <fbt:param name="hello">{fbtParams[0]}</fbt:param>
          <fbt:param name="world">{fbtParams[1]}</fbt:param>
        </fbt>
      ).toEqual(fbtParams.join(''));

      expect(
        fbt(
          fbt.param('hello', fbtParams[0]) + fbt.param('world', fbtParams[1]),
          'desc'
        )
      ).toEqual(fbtParams.join(''));
    });
  });

  describe(': given a string with implicit parameters', () => {
    function getFbt({
      count,
      object,
      ownerGender,
      viewer,
    }: Readonly<{
      count: number;
      object: string;
      ownerGender:
        | 'FEMALE_PLURAL'
        | 'FEMALE_SINGULAR'
        | 'FEMALE_SINGULAR_GUESS'
        | 'MALE_PLURAL'
        | 'MALE_SINGULAR'
        | 'MALE_SINGULAR_GUESS'
        | 'MIXED_UNKNOWN'
        | 'NEUTER_PLURAL'
        | 'NEUTER_SINGULAR'
        | 'NOT_A_PERSON'
        | 'UNKNOWN_PLURAL'
        | 'UNKNOWN_SINGULAR';
      viewer: {
        gender: IntlVariations;
        name: string;
      };
    }>) {
      return (
        <fbt desc="description">
          <fbt:name gender={viewer.gender} name="name">
            {viewer.name}
          </fbt:name>
          clicked on
          <strong>
            <fbt:pronoun gender={GenderConst[ownerGender]} type="possessive" />
            <a href="#link">
              <fbt:enum
                enum-range={{
                  comment: 'comment',
                  photo: 'photo',
                }}
                value={object}
              />
            </a>
          </strong>{' '}
          <em>
            <fbt:plural count={count} showCount="yes">
              time
            </fbt:plural>
          </em>
        </fbt>
      );
    }

    // DEBUG: show the babel-plugin-fbt transform output
    // console.warn('getFbt = \n----\n%s\n----\n', getFbt + '');

    const combinations: {
      counts: Array<number>;
      objects: Array<'photo' | 'comment'>;
      ownerGenders: Array<keyof typeof GenderConst>;
      viewers: Array<{
        gender: IntlVariations;
        name: string;
      }>;
    } = {
      counts: [1, 10],
      objects: ['photo', 'comment'],
      ownerGenders: ['FEMALE_SINGULAR', 'MALE_SINGULAR', 'UNKNOWN_PLURAL'],
      viewers: [
        {
          gender: IntlVariations.GENDER_MALE,
          name: 'Bob',
        },
        {
          gender: IntlVariations.GENDER_FEMALE,
          name: 'Betty',
        },
        {
          gender: IntlVariations.GENDER_UNKNOWN,
          name: 'Kim',
        },
      ],
    };

    combinations.viewers.forEach((viewer) =>
      combinations.ownerGenders.forEach((ownerGender) =>
        combinations.objects.forEach((object) =>
          combinations.counts.forEach((count) =>
            describe(`where viewer=${viewer.name}, ownerGender=${ownerGender}, object=${object}, count=${count}\n`, () =>
              it(`should produce proper nested fbt results`, () => {
                expect(
                  getFbt({
                    count,
                    object,
                    ownerGender,
                    viewer,
                  })
                ).toMatchSnapshot();
              }))
          )
        )
      )
    );
  });
});
