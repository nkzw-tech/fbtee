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
    // <fbt>
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
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },
    {
      code: `
        <fbt desc="Greeting">{}</fbt>;
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
          {}
        </fbt>;
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
          {null}
        </fbt>;
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
          {undefined}
        </fbt>;
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
          {/* This is a comment */}
        </fbt>;
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
          <span></span>
        </fbt>;
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
          <></>
        </fbt>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },

    // <fbs>
    {
      code: `
        <fbs desc="Greeting"></fbs>;
      `,
      errors: [
        {
          line: 2,
          messageId: 'jsxEmptyString',
        },
      ],
    },

    // fbt()
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

    // fbs()
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
    // <fbt>
    {
      code: `
        <fbt desc="Greeting">Hello world</fbt>;
      `,
    },
    {
      code: `
        <fbt desc="Greeting">
          Hello <span>world</span>
        </fbt>;
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
        <fbt desc="buy prompt">
          Buy a new
          <fbt:enum 
            enum-range={{
              CAR: 'car',
              HOUSE: 'house',
              BOAT: 'boat',
              HOUSEBOAT: 'houseboat',
            }} 
            value={enumVal} 
          />!
        </fbt>;
      `,
    },
    {
      code: `
        <fbt desc="welcome message">
          Hello
          <fbt:param name="name" value="Steve" />
        </fbt>;
      `,
    },
    {
      code: `
        <fbt desc="greeting">
          <Component />
        </fbt>;
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
        const text = 'Hello';
        fbt(text, 'Greeting');
      `,
    },

    // other
    {
      code: `
        name.replaceAll(' ', '-');
      `,
    },
  ],
});
