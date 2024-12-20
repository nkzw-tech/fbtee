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
  invalid: [
    {
      // <fbt>
      code: `
        <fbt desc="">Hello</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc={''}>Hello</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">Greeting</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc={'Greeting'}>Greeting</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc={'Greeting' + ''}>Greeting</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc="greeting">Greeting</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc="Hey">Hello world</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'shortDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc={'Hey'}>Hello world</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'shortDesc',
        },
      ],
    },
    {
      code: `
        <fbt desc={'Hey' + ''}>Hello world</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'shortDesc',
        },
      ],
    },

    // <fbs>
    {
      code: `
        <fbt desc="">Hello world</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyDesc',
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
          line: 2,
          messageId: 'emptyDesc',
        },
      ],
    },
    {
      code: `
        fbt('Hello world', \`\`);
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyDesc',
        },
      ],
    },
    {
      code: `
        fbt('Hello world', '' + '');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyDesc',
        },
      ],
    },
    {
      code: `
        fbt('Hello world', 'Hey');
      `,
      errors: [
        {
          line: 2,
          messageId: 'shortDesc',
        },
      ],
    },
    {
      code: `
        fbt('Greeting', 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
        },
      ],
    },
    {
      code: `
        fbt('Greeting', 'greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
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
          line: 2,
          messageId: 'emptyDesc',
        },
      ],
    },
    {
      code: `
        fbs('Hello world', 'a');
      `,
      errors: [
        {
          line: 2,
          messageId: 'shortDesc',
        },
      ],
    },
    {
      code: `
        fbs('Hello world', 'Hello world');
      `,
      errors: [
        {
          line: 2,
          messageId: 'duplicateDesc',
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
          line: 3,
          messageId: 'emptyDesc',
        },
      ],
    },
  ],
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

    // <fbs>
    {
      code: `
        <fbs desc="Greeting">Hello world</fbs>;
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
});
