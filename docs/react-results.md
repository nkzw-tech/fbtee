# React results in fbtee 6

fbtee now returns a JavaScript string for text-only messages and a real React Fragment for messages containing React nodes. Both the browser and server use the same result representation. Translation lookup, plural selection, parameter evaluation, and locale resolution still happen when the translation function is called.

Previously, browser results were instances of `FbtResult` that imitated React elements. Each instance allocated its own component function, so an interpolated translation could remount its children on every parent render. Real Fragments preserve child state and refs when their keys and positions remain stable. Unkeyed React parameters now receive keys through `cloneElement`, preserving React's element metadata. Keys track each token's occurrence independently, so reordering different parameters preserves their child state.

## Migrating application code

`fbt()` and `fbt.c()` return `FbtResult`, which is now a type alias for `string | ReactElement`. Use them as React children. For consumers that require text, use `fbs()` or `fbs.c()`:

```tsx
import { fbs, fbt } from 'fbtee';

<button aria-label={fbs('Save', 'Save button label')}>{fbt('Save', 'Save button label')}</button>;
```

Use `ReactNode` or `FbtResult` for props that render translations. Keep `string` or `TranslatedString` for text-only props, and supply those with `fbs()`. `TranslatedString` continues to describe the string-only API. `fbs.param()` and plural replacement values accept strings and numbers, including locale-aware number formatting. Switch nested helpers to `fbs.param()`, `fbs.plural()`, and `fbs.list()` when migrating a message. `fbs.list()` accepts text items; custom `fbs` result hooks return strings.

`FbtResult` is no longer a runtime class. Remove construction, subclassing, and `instanceof` checks. The old `getContents()`, `flattenToArray()`, `toJSON()`, and custom rich-result `toString()` behavior are removed. Custom `getFbtResult` hooks should return a string or a React element, for example a Fragment. The hook still receives resolved contents, the message hash, and the error listener. Use the hook argument for message metadata instead of inspecting the result's `key`.

The compiler's message hashes and translation catalogs do not change. Existing compilation output continues to call the same runtime helpers.

The ESLint plugin's recommended and strict configs enable [`@nkzw/fbtee/prefer-fbs`](../packages/eslint-plugin-fbtee/docs/rules/prefer-fbs.md). It rejects direct `String(fbt(...))`, `String(fbt.c(...))`, and `String(<fbt>…</fbt>)` expressions, including imported aliases. It does not require type information or follow values through variables. Fix the diagnostics by choosing the string API and updating imports and nested helpers as needed.

## Changes that type checking may miss

- `String(result)`, template interpolation, `.toString()`, and `JSON.stringify(result)` do not necessarily produce type errors for React elements. They continue to work for text-only results, including nested text translations. They no longer extract text from rich translations. Use a separate `fbs()` message for text output; do not stringify rendered UI.
- Text-only browser results are now primitives. `typeof`, `isValidElement`, object identity checks, and truthiness of an empty translation can change. Empty translations remain cached.
- Nested text parameters now participate in normal string punctuation handling, including stop deduplication, instead of being treated as opaque objects.
- React child state now survives ordinary translation updates. Components should not depend on an incidental translation remount to reset themselves; provide an explicit key when a reset is intended.
- A result with no rich content has no React key or props. `Children` traversal and structural snapshots of rich results now see a Fragment, rather than the old fake element or server-side array.

## Tests

The runtime tests cover plain and nested text, coercion/JSON of plain text, rich Fragments, cache hits (including empty strings and distinct message hashes), state preservation across token reordering, refs, repeated parameters, numeric `fbs` parameters and plurals, explicit and implicit keys, nested arrays, portals, and the string serialization error listener. Existing locale isolation, concurrent SSR, RSC, and compiler tests run against the new representation.

`pnpm --filter fbtee test:react` also tests state preservation and server-rendered hydration in both development and production using the built package and JSDOM. Build the package first with `pnpm --filter fbtee build`. JSDOM tests do not measure browser layout or painting.

## Benchmarks

Build the previous revision and preserve its entire `packages/fbtee/lib` directory before building this revision. Keep that copy below `packages/fbtee/node_modules/.cache/` so its dependencies resolve. For example, the local comparison used `packages/fbtee/node_modules/.cache/fbtee-v5/`, built from `bf242b14`.

After building the new runtime, run from the repository root:

```sh
FBTEE_BENCHMARK_ROUNDS=3 node packages/fbtee/scripts/benchmark-results.mjs \
  packages/fbtee/node_modules/.cache/fbtee-v5/index.mjs
```

Without a baseline argument, `pnpm --filter fbtee benchmark:results` measures only the current implementation. The existing `pnpm --filter fbtee benchmark` continues to measure singleton and request-scoped lookup performance.

Each version/environment runs in a separate production Node process. Browser workers install JSDOM before importing the runtime, which is important because v5 chose its result representation at module initialization. Workers warm each case, collect nine samples with explicit GC between samples, and emit JSON with samples, medians, ranges, Node/React versions, CPU, retained bytes per rich result, and child mount counts. Multiple rounds alternate the order of the versions.

Cases cover cached text, string interpolation, nested text, `fbs`, keyed and unkeyed React parameters, nested rich messages, text lists, server rendering, and synchronous client updates. Results are measurements, not CI timing thresholds. Server workers in v5 returned raw arrays for rich content, so adopting Fragments there adds a small retained element allocation. Measure both environments rather than assuming browser improvements apply identically to server memory.

### Local comparison

Measured on an Apple M5 Max with Node 26.13.0 and React 19.2.7. Values below are the median of three process medians (nine timed samples per process), in nanoseconds per operation. Baseline: `bf242b14`. These are local microbenchmarks, not browser frame-time measurements.

| Case                   | Browser v5 | Browser v6 | Server v5 | Server v6 |
| ---------------------- | ---------: | ---------: | --------: | --------: |
| Cached text            |         25 |         24 |        25 |        25 |
| Text parameter         |        374 |        351 |       424 |       356 |
| Nested text            |        995 |        840 |       940 |       841 |
| `fbs` parameter        |        520 |        434 |       510 |       431 |
| Keyed rich parameter   |        557 |        533 |       575 |       546 |
| Unkeyed rich parameter |        577 |        587 |       605 |       594 |
| Nested rich message    |      3,405 |      3,611 |     3,687 |     3,637 |
| Text list              |      5,859 |      5,614 |     5,733 |     5,685 |
| Server render          |      5,457 |      5,368 |     5,448 |     5,374 |
| Client update          |     12,050 |      4,488 |         — |         — |

The update workload mounted its child 20,000 times in v5 and once in v6. Its median update cost fell by 63%. Browser nested-rich construction increased by about 6% (206 ns); the change does not promise zero regression in every microbenchmark. Cached lookups stayed essentially unchanged, and text construction improved. Unkeyed rich construction was within 2% of the baseline. Retaining 20,000 rich results measured about 629 → 544 bytes per result in the browser and 448 → 544 on the server. The server increase reflects replacing raw arrays with real elements.
