# Prevent unhelpful descriptions being given to `<fbt>` or `fbt()` (fbtee/no-unhelpful-desc)

## Rule Details

This rule enforces that meaningful and non-empty descriptions are provided to <fbt> elements and fbt()/fbs() function calls. Descriptions (desc) are crucial for ensuring proper translation context and avoiding ambiguous or unhelpful translations.

Examples of **incorrect** code for this rule:

```jsx
<fbt desc="">Hello world</fbt>
```

```jsx
<fbt desc="foo">Hello world</fbt>
```

```jsx
<fbt desc="Hello world">Hello world</fbt>
```

```jsx
fbt('Hello world', '');
```

```jsx
fbt('Hello world', 'foo');
```

```jsx
fbt('Hello world', 'hello world');
```

Examples of **correct** code for this rule:

```jsx
<fbt desc="Greeting">Hello</fbt>
```

```jsx
fbt('Hello', 'Greeting');
```
