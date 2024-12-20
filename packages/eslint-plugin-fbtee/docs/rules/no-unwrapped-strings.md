# Enforce strings to be wrapped with `<fbt>` (fbtee/no-untranslated-strings)

## Rule Details

This rule enforces that all literal strings in your JSX are wrapped with an `<fbt>` tag, or translated using `fbt()`/`fbs()` functions, ensuring they are properly marked for translation.

Examples of **incorrect** code for this rule:

```jsx
<h1>Hello</h1>
```

```jsx
<h1>{`Hello`}</h1>
```

```jsx
<span title="Hello" />
```

Examples of **correct** code for this rule:

```jsx
<h1>
  <fbt desc="Greeting">Hello</fbt>
</h1>
```

```jsx
<h1>{fbt('Hello', 'Greeting')}</h1>
```

```jsx
<span title={fbs('Hello', 'Greeting')} />
```

## Rule Options

```js
...
"fbt/no-untranslated-strings": [<enabled>, {"ignoredWords": Array<string>}]
...
```

### `ignoredWords`

A list of words that are not required to be translated. Like so:

```jsx
"fbt/no-untranslated-strings": ["warn", { "ignoredWords": ["GitHub"] }]
```

## When Not To Use It

If you do not want to enforce all strings to be marked for translation, then you can disable this rule.
