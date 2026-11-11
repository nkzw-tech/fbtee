import { RuleTester } from '@typescript-eslint/rule-tester';
import plugin from '../index.tsx';
import rule from '../rules/prefer-fbs.tsx';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('prefer-fbs', rule, {
  invalid: [
    "String(fbt('Hello', 'Greeting'));",
    "String(fbt.c('Save'));",
    "String(fbt['c']('Save'));",
    "String((fbt('Hello', 'Greeting')));",
    "String(fbt('Hello', 'Greeting') as unknown);",
    "String(fbt('Hello', 'Greeting')!);",
    "String(fbt('Hello', 'Greeting') satisfies unknown);",
    "String(fbt?.('Hello', 'Greeting'));",
    "String(fbt(['Hello ', fbt.param('name', <b>Alice</b>)], 'Greeting'));",
    'String(<fbt desc="Greeting">Hello</fbt>);',
    "import { fbt } from 'fbtee'; String(fbt('Hello', 'Greeting'));",
    "import { fbt as translate } from 'fbtee'; String(translate('Hello', 'Greeting'));",
    "import { fbt as translate } from 'fbtee/server'; String(translate.c('Save'));",
    "import translate from 'fbtee'; String(translate('Hello', 'Greeting'));",
    "const { fbt } = useFbt(); String(fbt('Hello', 'Greeting'));",
    "function message(fbt) { return String(fbt('Hello', 'Greeting')); }",
  ].map((code) => ({ code, errors: [{ messageId: 'preferFbs' as const }], output: null })),
  valid: [
    "fbs('Hello', 'Greeting');",
    "fbs.c('Save');",
    "String(fbs('Hello', 'Greeting'));",
    "String(fbs.c('Save'));",
    'String(<fbs desc="Greeting">Hello</fbs>);',
    "String(fbt.param('name', 'Alice'));",
    "String(fbt._('Hello'));",
    "String(other('Hello'));",
    "import { fbs as fbt } from 'fbtee'; String(fbt('Hello', 'Greeting'));",
    "import { fbt } from 'other'; String(fbt('Hello', 'Greeting'));",
    "import fbt = require('other'); String(fbt('Hello'));",
    "function fbt(text) { return text; } String(fbt('Hello'));",
    "function example(String) { return String(fbt('Hello', 'Greeting')); }",
    "const String = value => value; String(fbt('Hello', 'Greeting'));",
    "import { fbt as translate } from 'fbtee'; function example(translate) { return String(translate('Hello')); }",
    "const result = fbt('Hello', 'Greeting'); String(result);",
    "const translate = fbt; String(translate('Hello', 'Greeting'));",
    'String();',
  ],
});

test('prefer-fbs is enabled in the recommended and strict configs', () => {
  expect(plugin.rules['prefer-fbs']).toBe(rule);
  expect(plugin.configs.recommended.rules['@nkzw/fbtee/prefer-fbs']).toBe(2);
  expect(plugin.configs.strict.rules['@nkzw/fbtee/prefer-fbs']).toBe(2);
});
