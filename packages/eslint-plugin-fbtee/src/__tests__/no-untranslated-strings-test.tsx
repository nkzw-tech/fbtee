import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../rules/no-untranslated-strings.tsx';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('no-untranslated-strings', rule, {
  invalid: [
    {
      code: `
        <span>Hello world</span>;
       `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <span>{'Hello world'}</span>;
       `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <span>{'Hello world' + ''}</span>;
       `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <div>
          <span>Hello world</span>
        </div>;
       `,
      errors: [
        {
          line: 3,
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <div>
          <div></div>
          Hello world
        </div>;
       `,
      errors: [
        {
          line: 4,
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <>Hello world</>
       `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
        <input placeholder="Enter name..." />;
       `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
          <div aria-label={'Label'}></div>
         `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
    {
      code: `
          <div aria-label={\`Label\`}></div>
         `,
      errors: [
        {
          messageId: 'unwrappedString',
        },
      ],
    },
  ],

  valid: [
    {
      code: `
        <fbt desc="Greeting">Hello world</fbt>
       `,
    },
    {
      code: `
        <fbt desc="Greeting">
          Hello world
        </fbt>
       `,
    },
    {
      code: `
        <fbt desc="Greeting">
          <span>Hello world</span>
        </fbt>
       `,
    },
    {
      code: `
        <span>
          {fbt('Hello', 'Greeting')}
        </span>
       `,
    },
    {
      code: `
        <fbt desc="Counter">
          Count:
          <fbt:plural count={1} showCount="yes" many="items">
            item
          </fbt:plural>
        </fbt>
       `,
    },
    {
      code: `
        <fbt desc="Greeting">
          <>Hello</>
        </fbt>
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
        <fbt desc="Welcome message">
          Welcome <fbt:param name="name">Steve</fbt:param>
        </fbt>
       `,
    },
    {
      code: `
        <div>
          <p>GitHub</p>
          <p>{'GitHub'}</p>
          <p>{\`GitHub\`}</p>
        </div>
       `,
      options: [
        {
          ignoredWords: ['GitHub'],
        },
      ],
    },
    {
      code: `
        <textarea rows={2}></textarea>
       `,
    },
    {
      code: `
        <a aria-current></a>
       `,
    },
    {
      code: `
        <img src="" alt={fbs('A photo of a dog', 'Image description')} />
       `,
    },
    {
      code: `
        <div aria-label={fbs('Hello', 'Greeting')}></div>
       `,
    },
    {
      code: `
        <div aria-label={fbt('Hello', 'Greeting').toString()}></div>
       `,
    },
    {
      code: `
       foo('Bar')
       `,
    },
    {
      code: `
       foo.bar('Baz')
       `,
    },
  ],
});
