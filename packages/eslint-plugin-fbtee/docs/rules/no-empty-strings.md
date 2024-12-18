# Prevent empty strings from being given to `<fbt>` or `fbt()` (fbtee/no-empty-strings)

## Rule Details

This rule ensures that <fbt> tags and fbt()/fbs() calls are given meaningful text and descriptions. Empty strings as children or arguments can result in untranslated content or unclear intent for translators, and this rule helps to catch such issues early.

Examples of **incorrect** code for this rule:

```jsx
<fbt desc="Greeting"></fbt>
```

```jsx
<fbt desc="Greeting">{''}</fbt>
```

```jsx
<fbt desc="">Hello</fbt>
```

```jsx
fbt('', 'Greeting');
```

```jsx
fbt('Hello', '');
```

Examples of **correct** code for this rule:

```jsx
<fbt desc="Greeting">Hello</fbt>
```

```jsx
fbt('Hello', 'Greeting');
```
