/* eslint-disable perfectionist/sort-objects */

import { describe, expect, jest, test } from '@jest/globals';
import TestFbtEnumManifest from '../__mocks__/TestFbtEnumManifest.tsx';
import FbtFunctionCallProcessor from '../babel-processors/FbtFunctionCallProcessor.tsx';
import { getExtractedStrings, PluginOptions } from '../index.tsx';
import { transform, withFbtImportStatement } from './FbtTestUtil.tsx';

type Options = Readonly<{
  fbtEnumManifest?: typeof TestFbtEnumManifest;
}>;

type TestCase = Readonly<{
  input: string;
  inputWithArraySyntax?: string;
  options?: Options;
  throws?: boolean | string;
}>;

type TestCases = Record<string, TestCase>;

const testSection = (
  testData: TestCases,
  transform: (source: string, options?: Options) => string,
) =>
  Object.entries(testData).forEach(([title, testInfo]) => {
    test(title, () => {
      if (testInfo.throws === true) {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow();
      } else if (typeof testInfo.throws === 'string') {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow(
          testInfo.throws,
        );
      } else {
        expect(transform(testInfo.input, testInfo.options)).toMatchSnapshot();
      }
    });
  });

const testCases: TestCases = {
  'should accept well-formed options': {
    input: withFbtImportStatement(
      `fbt('A string that moved files', 'options!', {
        author: 'jwatson',
        project: 'Super Secret',
      });`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `fbt(['A string that moved files'], 'options!', {
        author: 'jwatson',
        project: 'Super Secret',
      });`,
    ),
  },

  'should allow description concatenation': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A short string',
        'With a ridiculously long description that' +
          ' requires concatenation',
      );`,
    ),
  },

  'should avoid creating identifers with conflicted name when there exist inner strings and string variations':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var fbt_sv_arg_2 = 2;
        function a(fbt_sv_arg_3) {
          var fbt_sv_arg_0 = 1;
          <fbt desc="example 1">
            <fbt:param name="name" gender={this.state.ex1Gender}>
              <b className="padRight">{this.state.ex1Name}</b>
            </fbt:param>
            has shared
            <a className="neatoLink" href="#" tabindex={123} id={"uniq"}>
              <strong>
                <fbt:plural
                  many="photos"
                  showCount="ifMany"
                  count={this.state.ex1Count}>
                  a photo
                </fbt:plural>
              </strong>
            </a>
            with you
          </fbt>;
        }`,
      ),
    },

  'should be able to nest within React nodes': {
    input: withFbtImportStatement(
      `import React from 'react';
      var x = <div>{fbt('A nested string', 'nested!')}</div>;`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      var x = <div>{fbt(['A nested string'], 'nested!')}</div>;`,
    ),
  },

  'should convert simple strings': {
    input: withFbtImportStatement(
      `var x = fbt('A simple string', "It's simple");`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A simple string',
        ],
        "It's simple",
      );`,
    ),
  },

  'should deduplicate branches when fbt.enum() calls share the same key': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Look! ' +
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }) +
          ' and ' +
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }) +
          '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Look! ',
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }),
          ' and ',
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }),
          '!'
        ], 'enums!',
      );`,
    ),
  },

  'should deduplicate branches when fbt.enum() calls share the same key in string templates':
    {
      input: withFbtImportStatement(
        `var x = fbt(
          \`Look!  \${fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          })}  and  \${fbt.enum('groups', {
            "groups": 'groups',
            "photos": 'photos',
            "videos": 'videos',
          })}!\`,
          'enums!',
        );`,
      ),
    },

  'should get project from docblock': {
    input: `/** @fbt {"project": "dev"}*/
      ${withFbtImportStatement(
        `var x = fbt('Also simple string', "It's simple");`,
      )}`,

    inputWithArraySyntax: `/** @fbt {"project": "dev"}*/
      ${withFbtImportStatement(
        `var x = fbt(['Also simple string'], "It's simple");`,
      )}`,
  },

  'should handle JSX fbt with multiple levels of nested strings': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      <fbt desc="example 1">
        <b className="padRight">
          <fbt:enum enum-range={['today', 'yesterday']} value={enumVal} />
        </b>,
        <fbt:param name="name" gender={viewerGender}>
          <b className="padRight">{viewerName}</b>
        </fbt:param>
        has shared
        <a className="neatoLink" href="#">
          <fbt:plural many="photos" showCount="ifMany" count={photoCount}>
            a photo
          </fbt:plural>{' '}
          with
          <strong>
            <fbt:pronoun
              type="object"
              gender={otherGender}
              human="true" />
          </strong>
        </a>
      </fbt>;`,
    ),
  },

  'should handle JSX fbt with two nested React elements': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      <fbt desc="example 1">
        <fbt:param name="name" gender={this.state.ex1Gender}>
          <b className="padRight">{this.state.ex1Name}</b>
        </fbt:param>
        has shared
        <a className="neatoLink" href="#" tabindex={123} id={"uniq"}>
          <strong>
            <fbt:plural
              many="photos"
              showCount="ifMany"
              count={this.state.ex1Count}>
              a photo
            </fbt:plural>
          </strong>
        </a>
        with you
      </fbt>;`,
    ),
  },

  'should handle a JSX fragment nested with fbt.param as an argument': {
    input: '',
    inputWithArraySyntax: withFbtImportStatement(
      `import React from 'react';
      var x = fbt(
        [
          'A1 ',
          <a>
            B1
            <b>
              C1
              {
                // fbt constructs like fbt.pronoun() should return some opaque type
                // like FbtElement to work with React components
              }
              {fbt.param('paramName', paramValue)}
              C2
            </b>
            B2
          </a>,
          ' A2',
        ],
        'string with nested JSX fragments',
        {
          subject: subjectValue,
        }
      );`,
    ),
  },

  'should handle duplicate enums': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Look! ' +
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }) +
          ' and ' +
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }) +
          '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Look! ',
          fbt.enum('groups', {
            groups: 'Groups',
            photos: 'Photos',
            videos: 'Videos',
          }),
          ' and ',
          fbt.enum('groups', {
            groups: 'groups',
            photos: 'photos',
            videos: 'videos',
          }),
          '!',
        ],
        'enums!',
      );`,
    ),
  },

  'should handle enums (with array values)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' + fbt.enum('groups', ['groups', 'photos', 'videos']),
        'enum as an array',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.enum('groups', ['groups', 'photos', 'videos']),
        ],
        'enum as an array',
      );`,
    ),
  },

  'should handle enums (with enum range as variable)': {
    input: withFbtImportStatement(
      `var aEnum = require('Test$FbtEnum');
      var x = fbt(
        'Click to see ' + fbt.enum('id1', aEnum),
        'enum as an array',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var aEnum = require('Test$FbtEnum');
      var x = fbt(
        [
          'Click to see ',
          fbt.enum('id1', aEnum),
        ],
        'enum as an array',
      );`,
    ),
    options: { fbtEnumManifest: TestFbtEnumManifest },
  },

  'should handle enums (with value map)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' +
          fbt.enum('id1', {id1: 'groups', id2: 'photos', id3: 'videos'}),
        'enum as an object',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.enum('id1', {id1: 'groups', id2: 'photos', id3: 'videos'}),
        ],
        'enum as an object',
      );`,
    ),
  },

  'should handle enums with more text after': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Hello, ' + fbt.enum('groups', ['groups', 'photos', 'videos']) + '!',
        'enums!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Hello, ',
          fbt.enum('groups', ['groups', 'photos', 'videos']),
          '!',
        ], 'enums!',
      );`,
    ),
  },

  'should handle multiple plurals with no showCount (i.e. no named params)': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There ' +
        fbt.plural('is ', count, {many: 'are '}) +
        fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There ',
          fbt.plural('is ', count, {many: 'are '}),
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        ], 'plurals',
      );`,
    ),
  },

  'should handle names': {
    input: withFbtImportStatement(
      `var x = fbt(
        'You just friended ' + fbt.name('name', personname, gender),
        'names',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'You just friended ',
          fbt.name('name', personname, gender),
        ], 'names',
      );`,
    ),
  },

  'should handle object pronoun': {
    input: withFbtImportStatement(
      `var x = fbt(
          'I know ' +
            fbt.pronoun('object', gender) +
            '.',
          'object pronoun',
        );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
          [
            'I know ',
            fbt.pronoun('object', gender),
            '.'
          ],
          'object pronoun',
        );`,
    ),
  },

  'should handle params': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A parameterized message to ' +
          fbt.param('personName', truthy ? ifTrue : ifFalse),
        'Moar params',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A parameterized message to ',
          fbt.param('personName', truthy ? ifTrue : ifFalse),
        ],
        'Moar params',
      );`,
    ),
  },

  'should handle plurals that have different count variables': {
    input: withFbtImportStatement(
      `var x = fbt(
        fbt.plural('cat', catCount, {name: 'cat_token', showCount: 'yes'}) +
        ' and ' +
        fbt.plural('dog', dogCount, {name: 'dog_token', showCount: 'yes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          fbt.plural('cat', catCount, {name: 'cat_token', showCount: 'yes'}),
          ' and ',
          fbt.plural('dog', dogCount, {name: 'dog_token', showCount: 'yes'}),
        ],
        'plurals',
      )`,
    ),
  },

  'should handle plurals that share the same count variable': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There ' +
          fbt.plural('was ', count, {showCount: 'no', many: 'were '}) +
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There ',
          fbt.plural('was ', count, {showCount: 'no', many: 'were '}),
          fbt.plural('a like', count, {showCount: 'ifMany', many: 'likes'}),
        ],
        'plurals',
      )`,
    ),
  },

  'should handle possessive pronoun': {
    input:
      // I.e. It is her birthday.
      withFbtImportStatement(
        `var x = fbt(
          'It is ' + fbt.pronoun('possessive', gender) + ' birthday.',
          'possessive pronoun',
        );`,
      ),

    inputWithArraySyntax:
      // I.e. It is her birthday.
      withFbtImportStatement(
        `var x = fbt(
          [
            'It is ',
            fbt.pronoun('possessive', gender),
            ' birthday.'
          ], 'possessive pronoun',
        );`,
      ),
  },

  'should handle subject and reflexive pronouns': {
    input:
      // I.e. He wished himself a happy birthday.
      withFbtImportStatement(
        `var x = fbt(
          fbt.pronoun('subject', gender, {capitalize: true, human: true}) +
            ' wished ' +
            fbt.pronoun('reflexive', gender, {human: true}) +
            ' a happy birthday.',
          'subject+reflexive pronouns',
        );`,
      ),

    inputWithArraySyntax:
      // I.e. He wished himself a happy birthday.
      withFbtImportStatement(
        `var x = fbt(
          [
            fbt.pronoun('subject', gender, {capitalize: true, human: true}),
            ' wished ',
            fbt.pronoun('reflexive', gender, {human: true}),
            ' a happy birthday.'
          ], 'subject+reflexive pronouns',
        );`,
      ),
  },

  'should handle variations': {
    input: withFbtImportStatement(
      `var x = fbt(
        'Click to see ' + fbt.param('count', c, {number: true}) + ' links',
        'variations!',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'Click to see ',
          fbt.param('count', c, {number: true}),
          ' links',
        ], 'variations!',
      );`,
    ),
  },

  'should handle variations + same param': {
    input: withFbtImportStatement(
      `var val = 42;
      fbt(
        'You have ' +
        fbt.param('count', val, {number: true}) +
        ' likes. Comment on it to get more than ' +
        fbt.sameParam('count') +
        ' likes',
        'test variations + sameParam',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var val = 42;
      fbt(
        [
          'You have ',
          fbt.param('count', val, {number: true}),
          ' likes. Comment on it to get more than ',
          fbt.sameParam('count'),
          ' likes',
        ], 'test variations + sameParam',
      );`,
    ),
  },

  'should handler wrapping parens': {
    input: withFbtImportStatement(
      `var x = fbt('foo' + 'bar' + 'baz' + 'qux', 'desc');
      var y = fbt('foo' + ('bar' + 'baz' + 'qux'), 'desc');
      var q = fbt('foo' + 'bar' + ('baz' + 'qux'), 'desc');`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );
      var y = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );
      var q = fbt(
        [
          ('foo'),
          ('bar'),
          ('baz'),
          ('qux'),
        ], 'desc'
      );`,
    ),
  },

  'should insert param in place of fbt.sameParam if it exists': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param('name1', val1) + ' and ' + fbt.sameParam('name1'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param('name1', val1),
          ' and ',
          fbt.sameParam('name1'),
        ], 'd',
      );`,
    ),
  },

  // Initially needed for JS source maps accuracy
  'should maintain intra-argument newlines': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param(
          'name1',
          foo ? (
            <a>
              bar
            </a>
          ) : (
            qux
          ),
        ) +
          ' blah ' +
          fbt.param('name2', qux),
        'a',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param(
            'name1',
            foo ? (
              <a>
                bar
              </a>
            ) : (
              qux
            ),
          ),
          ' blah ',
          fbt.param('name2', qux),
        ], 'a',
      );`,
    ),
  },

  'should maintain newlines': {
    input: withFbtImportStatement(
      `var x = fbt(
        'A simple string... ' +
        'with some other stuff.',
        'blah'
      );
      baz();`,
    ),
  },

  // Initially needed for JS source maps accuracy
  // This is useful only for testing column/line coordinates
  // Newlines are not preserved in the extracted fbt string
  'should maintain newlines when using string templates': {
    input: withFbtImportStatement(
      `var x = fbt(
        \`A simple string...
with some other stuff.\`,
        'blah',
      );
      baz();`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          \`A simple string...
with some other stuff.\`
        ],
        'blah',
      );
      baz();`,
    ),
  },

  // Initially needed for JS source maps accuracy
  'should maintain newlines within arguments': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a' +
        ' b ' +
        fbt.param('name1', val1) +
        ' c ' +
        // comments
        ' d ' +
        fbt.param('name2', val2) +
        ' e ',
        'a',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a',
          ' b ',
          fbt.param('name1', val1),
          ' c ',
          // comments
          ' d ',
          fbt.param('name2', val2),
          ' e ',
        ], 'a',
      );`,
    ),
  },

  'should not throw for string with a nested JSX fragment and string variation arguments':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('count', someRandomFunction(), {number: true})}
                C2
                {fbt.plural('cat', catCount, {value: someValueFunction(), name: 'cat_token', showCount: 'ifMany', many: 'cats'})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),
    },

  'should not throw when a fbt.param is nested inside a fbt which is nested inside a fbt.name':
    {
      input: withFbtImportStatement(
        `var z = fbt(
        'a ' +
        fbt.name(
          'name',
          fbt(
            fbt.param('paramName', val2),
            "desc inner",
          ),
          gender,
        ) +
        ' b',
        'desc',
      );`,
      ),

      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'a ',
          fbt.name(
            'name',
            fbt(
              fbt.param('paramName', val2),
              "desc inner",
            ),
            gender,
          ),
          ' b',
        ], 'desc',
      );`,
      ),
    },

  'should respect the doNotExtract option': {
    input: withFbtImportStatement(
      `var x = fbt('A doNotExtract string', "should not be extracted", {doNotExtract: true});`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'A doNotExtract string',
        ],
        "should not be extracted",
        {doNotExtract: true}
      );`,
    ),
  },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested class instantiation.':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.plural('world', (new SomeRandomClass(), value))}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "count" ` +
        `to not contain a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:enum).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.enum(getValue(), ['world'])}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "value" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:name).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.name('name', getName(), getGender())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:param with gender).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('name', paramValue(), {gender: getGender()})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:param with number).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.param('name', paramValue(), {number: getNumber()})}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "number" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:plural).':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.plural('world', getValue())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "count" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and string variation arguments that have nested function calls (fbt:pronoun)':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
                {fbt.pronoun('object', getGender())}
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
        );`,
      ),

      throws:
        `Expected string variation runtime argument "gender" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw for string with a nested JSX fragment and subject gender contains function calls':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `import React from 'react';
        var x = fbt(
          [
            'A1 ',
            <a>
              B1
              <b>
                C1
              </b>
              B2
            </a>,
            ' A2',
          ],
          'string with nested JSX fragments',
          {
            subject: subjectValue(),
          }
        );`,
      ),

      throws:
        `Expected string variation runtime argument "subject" ` +
        `to not be a function call or class instantiation expression.`,
    },

  'should throw if the sameParam refers to a plural construct': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.plural('cat', count, {value: someValueFunction(), name: 'tokenName', showCount: 'yes'}) + ' and ' + fbt.sameParam('tokenName'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.plural('cat', count, {value: someValueFunction(), name: 'tokenName', showCount: 'yes'}),
          ' and ',
          fbt.sameParam('tokenName'),
        ], 'd',
      );`,
    ),

    throws:
      'Expected fbt `sameParam` construct with name=`tokenName` to refer to ' +
      'a `name` or `param` construct using the same token name',
  },

  'should throw if the token name of a sameParam construct in a nested string is not defined':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          fbt.param('name', val1),
          ' and ',
          <b>
            inner string
            {fbt.sameParam('name1')}
          </b>,
        ], 'd',
      );`,
      ),

      throws:
        'Expected fbt `sameParam` construct with name=`name1` to refer to ' +
        'a `name` or `param` construct using the same token name',
    },

  'should throw if the token name of a sameParam construct is not defined': {
    input: withFbtImportStatement(
      `var z = fbt(
        fbt.param('name1', val1) + ' and ' + fbt.sameParam('name2'),
        'd',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          fbt.param('name1', val1),
          ' and ',
          fbt.sameParam('name2'),
        ], 'd',
      );`,
    ),

    throws:
      'Expected fbt `sameParam` construct with name=`name2` to refer to ' +
      'a `name` or `param` construct using the same token name',
  },

  'should throw on bad showCount value': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There were ' + fbt.plural('a like', count, {showCount: 'badkey'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There were ',
          fbt.plural('a like', count, {showCount: 'badkey'}),
        ], 'plurals',
      );`,
    ),

    throws: `Option "showCount" has an invalid value: "badkey". Only allowed: ifMany, no, yes`,
  },

  'should throw on pronoun usage invalid': {
    input:
      // Note 'POSSESSION' instead of 'possessive'.
      withFbtImportStatement(
        `var x = fbt(
          'It is ' + fbt.pronoun('POSSESSION', gender) + ' birthday.',
          'throw because of unknown pronoun type',
        );`,
      ),

    inputWithArraySyntax:
      // Note 'POSSESSION' instead of 'possessive'.
      withFbtImportStatement(
        `var x = fbt(
          [
            'It is ',
            fbt.pronoun('POSSESSION', gender),
            ' birthday.'
          ], 'throw because of unknown pronoun type',
        );`,
      ),

    throws:
      `\`usage\`, the first argument of fbt.pronoun() - ` +
      `Expected value to be one of [object, possessive, reflexive, subject] ` +
      `but we got 'POSSESSION' (string) instead`,
  },

  'should throw on pronoun usage not StringLiteral': {
    input:
      // Note use of variable for pronoun usage.
      withFbtImportStatement(
        `var u = 'possessive';
        var x = fbt(
          'It is ' + fbt.pronoun(u, gender) + ' birthday.',
          'throw not StringLiteral',
        );`,
      ),

    inputWithArraySyntax:
      // Note use of variable for pronoun usage.
      withFbtImportStatement(
        `var u = 'possessive';
        var x = fbt(
          [
            'It is ',
            fbt.pronoun(u, gender),
            ' birthday.',
          ], 'throw not StringLiteral',
        );`,
      ),

    throws:
      '`usage`, the first argument of fbt.pronoun() must be a `StringLiteral` but we got `Identifier`',
  },

  'should throw on unknown options': {
    input: withFbtImportStatement(
      `var x = fbt(
        'There were ' + fbt.plural('a like', count, {whatisthis: 'huh?'}),
        'plurals',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var x = fbt(
        [
          'There were ',
          fbt.plural('a like', count, {whatisthis: 'huh?'}),
        ], 'plurals',
      );`,
    ),

    throws: `Invalid option "whatisthis". Only allowed: many, name, showCount, value, count`,
  },

  'should throw when a fbt.param is nested inside a fbt.name': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.name('name', fbt.param('paramName', val2), gender) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.name('name', fbt.param('paramName', val2), gender),
          ' b',
        ], 'desc',
      );`,
    ),

    throws: `'fbt' constructs should not be nested inside of other fbt constructs. Found 'fbt.param' nested inside 'fbt.name'.`,
  },

  'should throw when a fbt.param is nested inside another fbt.param': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.param('name', fbt.param('name2', val2)) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.param('name', fbt.param('name2', val2)),
          ' b',
        ], 'desc',
      );`,
    ),

    throws: `'fbt' constructs should not be nested inside of other fbt constructs. Found 'fbt.param' nested inside 'fbt.param'.`,
  },

  'should throw when a fbt.param is used outside of fbt': {
    input: withFbtImportStatement(`var z = fbt.param('name', val);`),

    throws: `fbt constructs must be used within the scope of other fbt constructs.`,
  },

  'should throw when concatenating an fbt construct to a string while using the array argument syntax':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var x = fbt(
          [
            'It is ' + fbt.pronoun('possessive', gender) + ' birthday.'
          ], 'throw because fbt constructs should be used as array items only',
        );`,
      ),

      throws:
        'fbt(array) only supports items that are string literals, ' +
        'template literals without any expressions, or fbt constructs',
    },

  'should throw when multiple tokens have the same names due to implicit params':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <a>world</a>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and an fbt.param':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          fbt.param('=world', value),
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and an fbt.plural':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <b>
            {fbt.plural('world', value)}
          </b>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when multiple tokens have the same names due to implicit params and fbt.enum':
    {
      input: '',
      inputWithArraySyntax: withFbtImportStatement(
        `var z = fbt(
        [
          'Hello ',
          <a>world</a>,
          ' ',
          <a>{
            fbt.enum(value, ['world'])
          }</a>,
        ], 'token name collision due to autoparam',
      );`,
      ),

      throws: `There's already a token called "=world" in this fbt call`,
    },

  'should throw when two arguments have the same names': {
    input: withFbtImportStatement(
      `var z = fbt(
        'a ' +
        fbt.param('name', val1) +
        fbt.param('name', val2) +
        ' b',
        'desc',
      );`,
    ),

    inputWithArraySyntax: withFbtImportStatement(
      `var z = fbt(
        [
          'a ',
          fbt.param('name', val1),
          fbt.param('name', val2),
          ' b',
        ], 'desc',
      );`,
    ),

    throws: `There's already a token called "name" in this fbt call`,
  },
};

const filterTestCasesByType = (
  testCases: TestCases,
  type: 'input' | 'inputWithArraySyntax',
) => {
  const filteredTestCases: Record<string, TestCase> = {};
  for (const title of Object.keys(testCases)) {
    const testCase = testCases[title];
    if (!testCase[type]?.length) {
      continue;
    }

    filteredTestCases[title] = {
      ...testCase,
      input: testCase[type],
    };
  }
  return filteredTestCases;
};

function withThrowExpectation(
  throwExpectation: boolean | string | undefined,
  callback: () => void,
) {
  return () => {
    if (throwExpectation === true) {
      expect(callback).toThrow();
    } else if (typeof throwExpectation === 'string') {
      expect(callback).toThrow(throwExpectation);
    } else {
      callback();
    }
  };
}

const describeTestScenarios = (testCases: TestCases) => {
  describe('Translation transform', () => {
    testSection(testCases, transform);
  });

  function forEachTestScenario(
    callback: (
      title: string,
      testCase: TestCase,
      options?: PluginOptions,
    ) => void,
  ) {
    for (const title of Object.keys(testCases)) {
      callback(title, testCases[title]);
    }
  }

  describe('Meta-data collection', () => {
    describe('should collect correct meta data', () => {
      forEachTestScenario((title: string, testCase: TestCase) => {
        test(
          `for scenario "${title}"`,
          withThrowExpectation(testCase.throws, () => {
            const pluginOptions = {
              collectFbt: true,
              fbtEnumManifest: testCase.options?.fbtEnumManifest,
              generateOuterTokenName: true,
            };
            transform(testCase.input, pluginOptions);
            expect(getExtractedStrings()).toMatchSnapshot();
          }),
        );
      });
    });

    describe('should create correct FbtNode objects', () => {
      forEachTestScenario((title: string, testCase: TestCase) => {
        test(
          `for scenario "${title}"`,
          withThrowExpectation(testCase.throws, () => {
            const spy = jest.spyOn(
              FbtFunctionCallProcessor.prototype,
              '_convertToFbtNode',
            );
            spy.mockClear();

            const pluginOptions = {
              collectFbt: true,
              fbtEnumManifest: testCase.options?.fbtEnumManifest,
              generateOuterTokenName: true,
            };
            transform(testCase.input, pluginOptions);

            expect(spy).toHaveBeenCalled();
            for (const result of spy.mock.results) {
              if (result.type === 'return') {
                expect(result.value).toMatchSnapshot();
              }
            }
          }),
        );
      });
    });
  });
};

describe('Functional FBT API', () => {
  describe('using string-concatenated arguments:', () => {
    describeTestScenarios(filterTestCasesByType(testCases, 'input'));
  });

  describe('using array arguments:', () => {
    describeTestScenarios(
      filterTestCasesByType(testCases, 'inputWithArraySyntax'),
    );
  });
});
