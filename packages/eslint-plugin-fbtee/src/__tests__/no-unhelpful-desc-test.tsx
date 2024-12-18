/* eslint-disable sort-keys-fix/sort-keys-fix */

// eslint-disable-next-line import/no-unresolved
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../rules/no-unhelpful-desc.tsx';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('unhelpful-desc', rule, {
  valid: [
    // <fbt>
    {
      code: `
        <fbt desc="Greeting">Hello world</fbt>;
      `,
    },
    {
      code: `
        <fbt desc={'Greeting'}>Hello</fbt>;
      `,
    },
    {
      code: `
        <fbt desc={\`Greeting\`}>Hello</fbt>;
      `,
    },
    {
      code: `
        <fbt
          desc={
            'A very long multiline description that ' +
            'is spanning multiple lines.'
          }
        >
          Hello
        </fbt>;
      `,
    },
    {
      code: `
        const description = 'Greeting';
        <fbt desc={description}>Hello</fbt>;
      `,
    },
    {
      code: `
        function getDescription() {
          return 'Greeting';
        }
        <fbt desc={getDescription()}>Hello</fbt>;
      `,
    },

    // fbt()
    {
      code: `
        fbt('Hello world', 'Greeting');
      `,
    },
    {
      code: `
        fbt('Hello world', \`Greeting\`);
      `,
    },
    {
      code: `
        fbt(
          'Hello world', 
          'A very long multiline description that ' +
          'is spanning multiple lines.'
        );
      `,
    },

    // fbs()
    {
      code: `
        fbs('Hello world', 'Greeting');
      `,
    },
    {
      code: `
        <input placeholder={fbs('Hello world', 'Greeting')} />;
      `,
    },
  ],
  invalid: [
    {
      // <fbt>
      code: `
        <fbt desc="">Hello</fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc={''}>Hello</fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">Greeting</fbt>;
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc={'Greeting'}>Greeting</fbt>;
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc={'Greeting' + ''}>Greeting</fbt>;
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="greeting">Greeting</fbt>;
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="Hey">Hello world</fbt>;
      `,
      errors: [
        {
          messageId: 'shortDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc={'Hey'}>Hello world</fbt>;
      `,
      errors: [
        {
          messageId: 'shortDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc={'Hey' + ''}>Hello world</fbt>;
      `,
      errors: [
        {
          messageId: 'shortDesc',
          line: 2,
        },
      ],
    },

    // fbt()
    {
      code: `
        fbt('Hello world', '');
      `,
      errors: [
        {
          messageId: 'emptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Hello world', \`\`);
      `,
      errors: [
        {
          messageId: 'emptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Hello world', '' + '');
      `,
      errors: [
        {
          messageId: 'emptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Hello world', 'Hey');
      `,
      errors: [
        {
          messageId: 'shortDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Greeting', 'Greeting');
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Greeting', 'greeting');
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },

    // fbs()
    {
      code: `
        fbs('Hello world', '');
      `,
      errors: [
        {
          messageId: 'emptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbs('Hello world', 'a');
      `,
      errors: [
        {
          messageId: 'shortDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbs('Hello world', 'Hello world');
      `,
      errors: [
        {
          messageId: 'duplicateDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <input 
          placeholder={fbs('Hello world', '')} 
        />;
      `,
      errors: [
        {
          messageId: 'emptyDesc',
          line: 3,
        },
      ],
    },
  ],
});
