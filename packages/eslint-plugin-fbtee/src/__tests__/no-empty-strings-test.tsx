/* eslint-disable sort-keys-fix/sort-keys-fix */

// eslint-disable-next-line import/no-unresolved
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../rules/no-empty-strings.tsx';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('no-empty-strings', rule, {
  valid: [
    {
      code: `
        <fbt desc="Greeting">Hello world</fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">{dynamicValue}</fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">Hello {name}</fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">{'Hello'}</fbt>;
      `,
    },
    {
      code: `
        fbt('Hello world', 'Greeting');
      `,
    },
    {
      code: `
        const text = 'Hello';
        fbt(text, 'Greeting');
      `,
    },
    {
      code: `
        <fbt desc="Greeting">
          <span>Non-empty child</span>
        </fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">
          <span>Non-empty child with empty sibling</span>
          <span></span>
        </fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">
          <>Hello</>
        </fbt>;
      `,
    },
  ],
  invalid: [
    {
      code: `
        <fbt desc="Greeting"></fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">{''}</fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">{\`\`}</fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc=""></fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 2,
        },
        {
          messageId: 'jsxEmptyDesc',
          line: 2,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">  </fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('', 'Greeting');
      `,
      errors: [
        {
          messageId: 'emptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt(\`\`, 'Greeting');
      `,
      errors: [
        {
          messageId: 'emptyText',
          line: 2,
        },
      ],
    },
    {
      code: `
        fbt('Hello', '');
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
        fbt('Hello', \`\`);
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
        <fbt desc="Greeting">
          {' '}
        </fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 3,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">
          <span></span>
        </fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 3,
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">
          <></>
        </fbt>;
      `,
      errors: [
        {
          messageId: 'jsxEmptyText',
          line: 3,
        },
      ],
    },
  ],
});
