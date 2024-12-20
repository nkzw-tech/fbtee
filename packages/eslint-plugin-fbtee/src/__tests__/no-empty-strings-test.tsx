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
  invalid: [
    {
      code: `
        <fbt desc="Greeting"></fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">{''}</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">{\`\`}</fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">  </fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
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
          line: 3,
          messageId: 'jsxEmptyString',
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
          line: 3,
          messageId: 'jsxEmptyString',
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
          line: 3,
          messageId: 'jsxEmptyString',
        },
      ],
    },
    {
      code: `
        fbt('', 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyString',
        },
      ],
    },
    {
      code: `
        fbt(' ', 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyString',
        },
      ],
    },
    {
      code: `
        fbt(\`\`, 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyString',
        },
      ],
    },
    {
      code: `
        fbt(\` \`, 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyString',
        },
      ],
    },
    {
      code: `
        fbs('', 'Greeting');
      `,
      errors: [
        {
          line: 2,
          messageId: 'emptyString',
        },
      ],
    },
  ],
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
    {
      code: `
        <fbt desc="Greeting">
          Apple{' '}Banana
        </fbt>;
      `,
    },
    {
      code: `
        name.replaceAll(' ', '-');
      `,
    },
  ],
});
