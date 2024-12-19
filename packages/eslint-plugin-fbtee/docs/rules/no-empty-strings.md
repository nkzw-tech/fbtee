# Prevent empty strings from being given to `<fbt>` or `fbt()` (fbtee/no-empty-strings)

## Rule Details

This rule ensures that `<fbt>` tags and `fbt()`/`fbs()` calls are given meaningful text.

Examples of **incorrect** code for this rule:

```jsx
<fbt desc="Greeting"></fbt>
```

```jsx
<fbt desc="Greeting">{''}</fbt>
```

```jsx
fbt('', 'Greeting');
```

Examples of **correct** code for this rule:

```jsx
<fbt desc="Greeting">Hello</fbt>
```

```jsx
fbt('Hello', 'Greeting');
```
