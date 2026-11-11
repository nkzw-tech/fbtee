# Prefer the string API over coercing React translations (@nkzw/fbtee/prefer-fbs)

Use `fbs()` when translated text is required. `fbt()` may return a React element, which `String()` silently converts to `[object Object]`. This rule is enabled in the recommended and strict configurations and does not require type information.

## Rule details

Examples of incorrect code:

```tsx
String(fbt('Hello', 'Greeting'));
String(fbt.c('Save'));
String(<fbt desc="Greeting">Hello</fbt>);
```

Use the string API directly:

```tsx
fbs('Hello', 'Greeting');
fbs.c('Save');
fbs(['Hello ', fbs.param('name', name)], 'Greeting');
```

The rule recognizes the conventional `fbt` binding, aliases imported from `fbtee` or `fbtee/server`, and common-string calls. Parentheses and TypeScript assertions do not hide a direct call. A locally shadowed `String` function is ignored.

There is no automatic fix: migrating a call can require adding an `fbs` import, updating nested helpers, and reviewing parameter values. `fbs.param()` accepts strings; do not blindly rename helpers that receive numbers or React nodes.

## Scope

This is a direct-expression check. It deliberately does not trace variables, returned values, or translator aliases created through assignments:

```tsx
const message = fbt('Hello', 'Greeting');
String(message);
```

It also does not analyze template interpolation, `.toString()`, or JSON serialization. Review those separately during migration. This rule does not change runtime behavior or add runtime overhead.
