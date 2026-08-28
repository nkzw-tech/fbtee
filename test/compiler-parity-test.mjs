import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync as babelTransform } from '@babel/core';
import { describe, test } from '@jest/globals';
import babelFbteeAutoImportPlugin from '../packages/babel-plugin-fbtee-auto-import/lib/index.mjs';
import babelFbteePlugin, {
  getChildToParentRelationships,
  getExtractedStrings,
} from '../packages/babel-plugin-fbtee/lib/index.mjs';
import {
  collectSync as oxcCollect,
  transformSync as oxcTransform,
} from '../packages/oxc-transform-fbtee/index.js';

const compileBabel = (source, options = {}, autoImport = false) =>
  babelTransform(source, {
    babelrc: false,
    configFile: false,
    filename: 'fixture.tsx',
    parserOpts: {
      plugins: ['jsx', 'typescript'],
      sourceType: 'module',
    },
    plugins: [
      ...(autoImport ? [babelFbteeAutoImportPlugin] : []),
      [babelFbteePlugin, options],
    ],
  }).code;

const compileOxc = (source, options = {}) => {
  const result = oxcTransform('fixture.tsx', source, {
    lang: 'tsx',
    sourceType: 'module',
    ...options,
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map(({ message }) => message).join('\n'));
  }
  return result.code;
};

const compilers = {
  babel: compileBabel,
  oxc: compileOxc,
};

const collectBabel = (source, options = {}) => {
  babelTransform(source, {
    ast: false,
    babelrc: false,
    code: false,
    configFile: false,
    filename: 'fixture.tsx',
    parserOpts: {
      plugins: ['jsx', 'typescript'],
      sourceType: 'module',
    },
    plugins: [
      [
        babelFbteePlugin,
        {
          collectFbt: true,
          filename: 'fixture.tsx',
          ...options,
        },
      ],
    ],
  });
  // JSON serialization intentionally drops Babel AST fields whose values are undefined.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(
    JSON.stringify({
      childParentMappings: Object.fromEntries(getChildToParentRelationships()),
      phrases: getExtractedStrings(),
    }),
  );
};

const collectOxc = (source, options = {}) => {
  const result = oxcCollect('fixture.tsx', source, {
    lang: 'tsx',
    sourceType: 'module',
    ...options,
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map(({ message }) => message).join('\n'));
  }
  return JSON.parse(result.output);
};

const hashes = (code) =>
  [...code.matchAll(/\bhk\s*:\s*["']([^"']+)["']/g)].map((match) => match[1]);

const exampleFile = new URL(
  '../example/src/example/Example.tsx',
  import.meta.url,
);
const exampleOptions = {
  fbtCommon: JSON.parse(
    readFileSync(
      new URL('../example/common_strings.json', import.meta.url),
      'utf8',
    ),
  ),
  fbtEnumManifest: JSON.parse(
    readFileSync(
      new URL('../example/.enum_manifest.json', import.meta.url),
      'utf8',
    ),
  ),
};

const validFixtures = [
  {
    name: 'simple call',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description');`,
  },
  {
    name: 'collected member-expression subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: viewer.gender});`,
  },
  {
    name: 'UTF-16 collector locations',
    source: `import { fbt } from 'fbtee'; const emoji = '😀'; const x = fbt('Hello', 'description', {subject: viewer.gender});`,
  },
  {
    name: 'collected optional-call subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: viewer?.getGender()});`,
  },
  {
    name: 'collected optional-member-chain subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: viewer?.gender.value});`,
  },
  {
    name: 'collected regular-expression subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: /human/gi});`,
  },
  {
    name: 'collected parenthesized object subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: ({gender: viewer.gender})});`,
  },
  {
    name: 'collected template subject metadata',
    source: `import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {subject: \`gender-\${viewer.gender}\`});`,
  },
  {
    name: 'file-level doNotExtract collector default',
    source: `/** @fbt {"doNotExtract":true} */ import { fbt } from 'fbtee'; const x = fbt('Hello', 'description');`,
  },
  {
    name: 'callsite doNotExtract overrides the file default',
    source: `/** @fbt {"doNotExtract":true} */ import { fbt } from 'fbtee'; const x = fbt('Hello', 'description', {doNotExtract: false});`,
  },
  {
    name: 'trimmed functional description',
    source: `import { fbt } from 'fbtee'; const x = fbt('A', '  d  ');`,
  },
  {
    name: 'trimmed JSX description',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="  d  ">A</fbt>;`,
  },
  {
    name: 'trimmed common description',
    options: { fbtCommon: { A: '  d  ' } },
    source: `import { fbt } from 'fbtee'; const x = fbt.c('A');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /fbt\._param\(["'] x ["'],\s*value\)/);
      }
    },
    name: 'raw functional token name',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param(' x ', value), 'd');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /fbt\._param\(["']y["'],\s*value\)/);
      }
    },
    name: 'functional param name override',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param(dynamicName, value, {name: 'y'}), 'd');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /fbt\._name\(["'] n ["']/);
        assert.match(code, /fbt\._plural\(count,\s*["'] c ["']/);
        assert.match(code, /fbt\._list\(["'] l ["']/);
      }
    },
    name: 'raw functional construct token names',
    source: `import { fbt } from 'fbtee'; const x = fbt([fbt.param(' p ', value), fbt.sameParam(' p '), fbt.name(' n ', person, gender), fbt.plural('cat', count, {showCount: 'yes', name: ' c '}), fbt.list(' l ', items)], 'd');`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /project\s*:\s*["']dev["']/, compiler);
      }
    },
    name: '@fbt docblock after a shebang',
    source: `#!/usr/bin/env node
      /** @fbt {"project":"dev"} */
      import { fbt } from 'fbtee'; const x = fbt('A', 'd');`,
  },
  {
    babelAutoImport: true,
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /import\s*{\s*fbt\s*}\s*from\s*["']fbtee["']/);
        assert.match(code, /fbt\._\(["']A["']/);
      }
    },
    name: 'type-only declaration does not shadow JSX fbt',
    source: `type fbt = string; const x = <fbt desc="d">A</fbt>;`,
  },
  {
    name: 'implicit token alias insertion order',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><b>z</b><i>a</i></fbt>;`,
  },
  {
    name: 'JSX enum string literal value',
    options: {
      fbtEnumManifest: {
        Test$FbtEnum: { id1: 'groups', id2: 'photos', id3: 'videos' },
      },
    },
    source: `import { fbt } from 'fbtee'; import aEnum from 'Test$FbtEnum'; const x = <fbt desc="enums!">Click to see <fbt:enum enum-range={aEnum} value="id1" /></fbt>;`,
  },
  {
    name: 'await value in a varied implicit phrase',
    source: `import { fbt } from 'fbtee'; async function x() { return <fbt desc="d"><b><fbt:param name="x" gender={gender}>{await value}</fbt:param></b></fbt>; }`,
  },
  {
    name: 'yield value in a varied implicit phrase',
    source: `import { fbt } from 'fbtee'; function* x() { return <fbt desc="d"><b><fbt:param name="x" gender={gender}>{yield value}</fbt:param></b></fbt>; }`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /webpackChunkName:\s*["']settings["']/, compiler);
      }
    },
    name: 'semantic comments inside dynamic values',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param('x', import(/* webpackChunkName: "settings" */ './settings')), 'd');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /project\s*:\s*["']dev["']/);
      }
    },
    name: '@fbt docblock followed by another pragma',
    source: `/** @fbt {"project":"dev"}
     * @format
     */
    import { fbt } from 'fbtee'; const x = fbt('A', 'd');`,
  },
  {
    name: 'CommonJS destructured fbtee binding',
    source: `const { fbt } = require('fbtee'); const x = fbt('A', 'B');`,
  },
  {
    check({ oxc }) {
      assert.equal(oxc.match(/require\(["']fbtee["']\)/g)?.length, 1);
      assert.doesNotMatch(oxc, /import\s*{\s*fbt\s*}/);
    },
    name: 'scoped CommonJS fbtee binding',
    source: `const fbt = local; function x() { const fbt = require('fbtee'); return fbt('A', 'B'); }`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(
          code,
          /fbt\._param\(["']two lines["'],\s*value\)/,
          compiler,
        );
      }
    },
    name: 'normalized multiline parameter token name',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="two
 lines">{value}</fbt:param></fbt>;`,
  },
  {
    name: '@fbt preserveWhitespace is not a callsite default',
    source: `/** @fbt {"preserveWhitespace":true} */
      import { fbt } from 'fbtee'; const x = fbt(' A  B ', 'd');`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.doesNotMatch(code, /fbt\._subject/);
      }
    },
    name: '@fbt subject is not a callsite default',
    source: `/** @fbt {"subject":"gender"} */
      import { fbt } from 'fbtee'; const x = fbt('A', 'd');`,
  },
  {
    name: 'JSX string boolean option',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d" preserveWhitespace="true"> A  B </fbt>;`,
  },
  {
    name: 'trimmed implicit whitespace',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="outer">Click <b> world </b></fbt>;`,
  },
  {
    name: 'named construct description',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="outer">Click <b><fbt:param name="user">{user}</fbt:param></b></fbt>;`,
  },
  {
    name: 'shared number parameter and plural variation',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param('a', n, {number: true}) + fbt.plural('cat', n), 'd');`,
  },
  {
    name: 'duplicate plural names without runtime tokens',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:plural count={won} many="won games" name="number of games" showCount="no">won game</fbt:plural>, <fbt:plural count={lost} many="lost games" name="number of games" showCount="no">lost game</fbt:plural></fbt>;`,
  },
  {
    // JavaScript enumerates integer-index keys before other properties.
    name: 'numeric enum object key order',
    source: `import { fbt } from 'fbtee'; const x = fbt('Value: ' + fbt.enum(value, {10: 'Ten', 2: 'Two', z: 'Zulu'}), 'd');`,
  },
  {
    name: 'preserveWhitespace inside an implicit phrase',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d" preserveWhitespace={true}>A <b> C
 D </b> B</fbt>;`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.equal(code.match(/fbt\._param\(["']x["'],\s*x\)/g)?.length, 1);
      }
    },
    name: 'functional syntax containing JSX constructs',
    source: `import { fbt } from 'fbtee'; const x = fbt(['A ', <b>{fbt.param('x', x)}</b>], 'd');`,
  },
  {
    // Mirrors Babel's established nested-functional-JSX fixture, including a
    // shared subject variation propagated through every implicit phrase.
    name: 'functional nested JSX with a shared subject variation',
    source: `import { fbt } from 'fbtee'; const x = fbt(['A1 ', <a>B1 <b>C1 {fbt.param('paramName', paramValue)} C2</b> B2</a>, ' A2'], 'string with nested JSX fragments', {subject: subjectValue});`,
  },
  {
    check(outputs) {
      assert.doesNotMatch(outputs.babel, /\bvar\s+\w*fbt_sv_arg/);
      const assignments = [
        ...outputs.babel.matchAll(/([\w$]*fbt_sv_arg[\w$]*)\s*=\s*fbt\._enum/g),
      ].map((match) => match[1]);
      assert.equal(assignments.length, 2, outputs.babel);
      assert.equal(new Set(assignments).size, 2, outputs.babel);
    },
    name: 'conditional nested enums use unique React Compiler compatible temporaries',
    source: `import { fbt } from 'fbtee'; function PlayerPosition({color, confirm}) { return confirm ? <fbt desc="pick"><span><fbt:enum enum-range={['blue position', 'red position']} value={color + ' position'} /></span></fbt> : <fbt desc="play"><span><fbt:enum enum-range={['blue position', 'red position']} value={color + ' position'} /></span></fbt>; }`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /fbt\._plural\(n\)/, compiler);
        assert.doesNotMatch(code, /fbt\._plural\(n,\s*["']n["']/, compiler);
      }
    },
    name: 'showCount no omits plural name and value',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', n, {name: 'n', value: v, showCount: 'no'}), 'd');`,
  },
  {
    name: 'normalized functional common string',
    options: { fbtCommon: { Required: 'required field' } },
    source: `import { fbt } from 'fbtee'; const x = fbt.c('  Required  ');`,
  },
  {
    name: 'two adjacent nested implicit phrases',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">
      <div href="#">
        one
        <div href="#">two</div>
      </div>
      <div href="#">
        three
        <div href="#">four</div>
      </div>
    </fbt>;`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /project\s*:\s*["']dev["']/);
      }
    },
    name: '@fbt docblock project default',
    source: `/** @fbt {"project":"dev"} */
      import { fbt } from 'fbtee'; const x = fbt('Also simple string', "It's simple");`,
  },
  {
    name: 'nested implicit phrase with gender and plural variations',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="example 1"><fbt:param gender={gender} name="name"><b>{name}</b></fbt:param> has shared <a><fbt:plural count={count} many="photos" showCount="ifMany">a photo</fbt:plural></a> with you</fbt>;`,
  },
  {
    // This also covers a collapsible repeated enum and two levels of implicit JSX.
    name: 'nested implicit phrases with enum and pronoun variations',
    options: {
      fbtEnumManifest: {
        Example$FbtEnum: {
          LINK: 'link',
          PAGE: 'page',
          PHOTO: 'photo',
          POST: 'post',
          VIDEO: 'video',
        },
      },
    },
    source: `import { fbt } from 'fbtee'; import ExampleEnum from './Example$FbtEnum.ts'; const x = <fbt desc="Example enum & pronoun"><fbt:param name="name"><b><a href="#">{person}</a></b></fbt:param> has a <fbt:enum enum-range={ExampleEnum} value={object} /> to share!{' '}<b><a href="#">View</a></b>{' '}<fbt:pronoun gender={gender} human={false} type="possessive" />{' '}<fbt:enum enum-range={ExampleEnum} value={object} />.</fbt>;`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        const actualHashes = hashes(code);
        for (const hash of ['46j2Ai', 'BNUvh', 'qcSj6', '26triK', '283TK8']) {
          assert.ok(
            actualHashes.includes(hash),
            `${compiler} is missing ${hash}`,
          );
        }
      }
    },
    name: 'complete example application',
    options: exampleOptions,
    source: readFileSync(exampleFile, 'utf8'),
  },
  {
    name: 'enum manifest insertion order',
    options: {
      fbtEnumManifest: {
        Example$FbtEnum: Object.fromEntries([
          ['z', 'Zulu'],
          ['a', 'Alpha'],
        ]),
      },
    },
    source: `import { fbt } from 'fbtee'; import Example from './Example$FbtEnum'; const x = fbt('Value: ' + fbt.enum(value, Example), 'd');`,
  },
  {
    // Babel is the collector and therefore the ordering/hash authority here.
    name: 'enum manifest JavaScript numeric-key order',
    options: {
      fbtEnumManifest: {
        Example$FbtEnum: Object.fromEntries([
          ['10', 'Ten'],
          ['2', 'Two'],
          ['z', 'Zulu'],
        ]),
      },
    },
    source: `import { fbt } from 'fbtee'; import Example from './Example$FbtEnum'; const x = fbt('Value: ' + fbt.enum(value, Example), 'd');`,
  },
  {
    name: 'multiline nested implicit aliases',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">
      <div href="#">
        <div href="#">this is</div>
        a doubly
      </div>
      nested test
    </fbt>;`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.doesNotMatch(code, /She wished himself|They wished herself/);
        assert.match(code, /She wished herself/, compiler);
      }
    },
    name: 'pronouns sharing a gender variation',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.pronoun('subject', gender, {capitalize: true, human: true}) + ' wished ' + fbt.pronoun('reflexive', gender, {human: true}) + ' a happy birthday.', 'subject+reflexive pronouns');`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.doesNotMatch(code, /she saw himself|they saw herself/);
        assert.match(code, /she saw herself/, compiler);
      }
    },
    name: 'pronouns with different candidate sets sharing a gender variation',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.pronoun('subject', gender) + ' saw ' + fbt.pronoun('reflexive', gender), 'related pronouns');`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /You can add this tag to anything\./, compiler);
        assert.match(code, /You can add thesetags to anything\./, compiler);
      }
    },
    name: 'singular whitespace between consecutive JSX constructs',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="">
      You can add
      <fbt:plural count={count} many="these">
        this
      </fbt:plural>
      <fbt:plural count={count} many="tags">
        tag
      </fbt:plural>
      to anything.
    </fbt>;`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(
          code.replaceAll(/\s+/g, ' '),
          /fbs\._param\(["']space["'], ["'] ["']\)/,
          `${compiler} did not emit a string-valued fbs param`,
        );
      }
    },
    name: 'text-only fbs param',
    source: `import { fbs } from 'fbtee'; const x = <fbs desc="outer">A<fbs:param name="space"> </fbs:param>B</fbs>;`,
  },
  {
    name: 'sameParam across an implicit phrase boundary',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="foo">{foo}</fbt:param> <b><fbt:same-param name="foo" /></b></fbt>;`,
  },
  {
    name: 'nested fbt inside an explicit JSX param',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">
      <fbt:param name="explicit fbt param">
        <div>
          <fbt desc="d2">
            explicit fbt param
            <div>with a nested implicit param</div>
          </fbt>
        </div>
      </fbt:param>
    </fbt>;`,
  },
  {
    name: 'three levels of implicit JSX',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">
      <div href="#">
        one
        <div href="#">
          two
          <div href="#">test</div>
        </div>
      </div>
      <div href="#">
        three
        <div href="#">four</div>
      </div>
    </fbt>;`,
  },
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /\/\*\s*#?__PURE__\s*\*\/\s*fbt\._/, compiler);
      }
    },
    name: 'pure annotation on a transformed call',
    source: `import { fbt } from 'fbtee'; const x = /*#__PURE__*/ fbt('A', 'd');`,
  },
  {
    name: 'parenthesized fbt callee',
    source: `import { fbt } from 'fbtee'; const x = (fbt)('A', 'd');`,
  },
  ...[
    ['duplicate object enum keys', `{a: 'A', a: 'B'}`],
    ['duplicate array enum values', `['A', 'A', 'B']`],
  ].map(([name, range]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.enum(value, ${range}), 'd');`,
  })),
  {
    check(outputs) {
      for (const [compiler, code] of Object.entries(outputs)) {
        assert.match(code, /_plural\(count,\s*["']two lines["']\)/, compiler);
      }
    },
    name: 'normalized multiline JSX plural name',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:plural count={count} name="two
 lines" showCount="yes">item</fbt:plural></fbt>;`,
  },
  ...[
    [
      'empty functional project inherits docblock',
      `/** @fbt {"project":"dev"} */ import { fbt } from 'fbtee'; const x = fbt('A', 'd', {project: ''});`,
    ],
    [
      'empty JSX project inherits docblock',
      `/** @fbt {"project":"dev"} */ import { fbt } from 'fbtee'; const x = <fbt desc="d" project="">A</fbt>;`,
    ],
  ].map(([name, source]) => ({
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /project\s*:\s*["']dev["']/);
      }
    },
    name,
    source,
  })),
  {
    name: 'parenthesized shared variation expression',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', count) + ' and ' + fbt.plural('dog', (count)), 'd');`,
  },
  ...[
    ['large numeric enum key', `{1e21: 'value'}`],
    ['small numeric enum key', `{1e-7: 'value'}`],
  ].map(([name, range]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.enum(value, ${range}), 'd');`,
  })),
  {
    name: 'fbtee server entrypoint',
    source: `import { fbs } from 'fbtee/server'; export const title = fbs('Title', 'server title');`,
  },
  {
    name: 'named local fbtee facade',
    source: `import { fbt } from './i18n'; export const title = fbt('Title', 'facade title');`,
  },
  {
    name: 'default local fbtee facade',
    source: `import fbt from './i18n'; export const title = fbt('Title', 'facade title');`,
  },
  {
    name: 'namespace local fbtee facade',
    source: `import * as fbt from './i18n'; export const title = fbt('Title', 'facade title');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.ok(
          code.indexOf('_param("explicit", c())') <
            code.indexOf('_implicitParam'),
          code,
        );
      }
    },
    name: 'explicit parameter evaluation before implicit JSX',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><b><fbt:param name="implicit">{a()}</fbt:param></b><fbt:param name="explicit">{c()}</fbt:param></fbt>;`,
  },
  {
    name: 'ordinary leading comment mentioning @fbt',
    source: `/* This module documents the @fbt implementation. */ export const x = 1;`,
  },
  {
    name: 'Babel JSX entity set',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">&NotEqualTilde;</fbt>;`,
  },
  {
    name: 'Babel JSX entity set in attributes',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="&NotEqualTilde;"><fbt:plural count={count} many="&NotEqualTilde;">A</fbt:plural></fbt>;`,
  },
  {
    name: 'Babel JSX entity set in common strings',
    options: { fbtCommon: { '&NotEqualTilde;': 'common description' } },
    source: `import { fbt } from 'fbtee'; const x = <fbt common>&NotEqualTilde;</fbt>;`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(
          code,
          /_list\(["']x["'], items, getConjunction\(\), getDelimiter\(\)\)/,
        );
      }
    },
    name: 'dynamic list formatting arguments',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.list('x', items, getConjunction(), getDelimiter()), 'd');`,
  },
  {
    name: 'static concatenated plural many option',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', count, {many: 'kit' + 'ties'}), 'd');`,
  },
  {
    check(outputs) {
      for (const code of Object.values(outputs)) {
        assert.match(code, /project:\s*["']ab["']/);
      }
    },
    name: 'static concatenated functional text options',
    source: `import { fbt } from 'fbtee'; const x = fbt('A', 'd', {author: 'c' + 'd', project: 'a' + 'b'});`,
  },
];

describe('valid inputs produce compatible compiler output', () => {
  test.each(validFixtures)('$name', (fixture) => {
    const compilerNames = Object.keys(compilers);
    const outputs = {};

    for (const name of compilerNames) {
      try {
        outputs[name] = compilers[name](
          fixture.source,
          fixture.options,
          name === 'babel' && fixture.babelAutoImport,
        );
      } catch (error) {
        throw new Error(
          `${name.toUpperCase()} failed to compile the fixture.`,
          {
            cause: error,
          },
        );
      }
    }

    const expectedHashes = hashes(outputs.babel);
    for (const compiler of compilerNames.filter((name) => name !== 'babel')) {
      assert.deepEqual(
        hashes(outputs[compiler]),
        expectedHashes,
        `${compiler.toUpperCase()} hashes must match Babel`,
      );
    }
    fixture.check?.(outputs);
  });
});

const invalidFixtures = [
  {
    name: 'arrow-function call option',
    source: `import { fbt } from 'fbtee'; const x = fbt('A', 'd', {subject: () => 1});`,
  },
  {
    name: 'functional param with gender and number',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param('x', value, {gender, number: true}), 'd');`,
  },
  {
    name: 'parenthesized standalone construct',
    source: `import { fbt } from 'fbtee'; const x = (fbt).param('x', value);`,
  },
  ...[
    ['empty enum array', '[]'],
    ['empty enum object', '{}'],
  ].map(([name, range]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.enum(value, ${range}), 'd');`,
  })),
  {
    name: 'false common without description',
    source: `import { fbt } from 'fbtee'; const x = <fbt common="false">A</fbt>;`,
  },
  {
    name: 'dynamic plural many option',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', count, {many: dynamic}), 'd');`,
  },
  {
    name: 'template literal functional text option',
    source:
      "import { fbt } from 'fbtee'; const x = fbt('A', 'd', {project: `ab`});",
  },
  ...[
    ['trailing fbt docblock content', `{"project":"p"} trailing`],
    ['non-string fbt docblock author', `{"author":3}`],
  ].map(([name, options]) => ({
    name,
    source: `/** @fbt ${options} */ import { fbt } from 'fbtee'; const x = fbt('A', 'd');`,
  })),
  {
    name: 'JSX param with gender and number',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="x" gender={gender} number={true}>{value}</fbt:param></fbt>;`,
  },
  ...[
    ['JSX param with false number expression', '{false}'],
    ['JSX param with false number string', '"false"'],
  ].map(([name, number]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="x" number=${number}>{value}</fbt:param></fbt>;`,
  })),
  {
    name: 'empty functional param name',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param('', value), 'd');`,
  },
  {
    name: 'non-self-closing JSX enum',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:enum enum-range={{a: 'A'}} value="a">LOST</fbt:enum></fbt>;`,
  },
  {
    name: 'dynamic JSX plural child',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:plural count={count}>{label}</fbt:plural></fbt>;`,
  },
  {
    name: 'array spread',
    source: `import { fbt } from 'fbtee'; const x = fbt(['A', ...parts, 'B'], 'd');`,
  },
  {
    name: 'concatenated functional array item',
    source: `import { fbt } from 'fbtee'; const x = fbt(['It is ' + fbt.pronoun('possessive', gender) + ' birthday.'], 'd');`,
  },
  ...[
    ['concatenated enum array value', `['a' + 'b']`],
    ['template enum array value', '[`a`]'],
    ['concatenated enum object value', `{A: 'a' + 'b'}`],
  ].map(([name, range]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.enum(value, ${range}), 'd');`,
  })),
  {
    name: 'named enum import',
    options: {
      fbtEnumManifest: { Test$FbtEnum: { A: 'a' } },
    },
    source: `import { fbt } from 'fbtee'; import { TestEnum } from './Test$FbtEnum'; const x = fbt(fbt.enum(value, TestEnum), 'd');`,
  },
  {
    name: 'invalid showCount',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', count, {showCount: 'sometimes'}), 'd');`,
  },
  {
    name: 'unknown plural option',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.plural('cat', count, {unknown: true}), 'd');`,
  },
  {
    name: 'invalid pronoun usage',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.pronoun('possession', gender), 'd');`,
  },
  {
    name: 'incompatible reused enum ranges',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.enum(value, {A: 'a', B: 'b'}) + fbt.enum(value, {A: 'a'}), 'd');`,
  },
  ...[
    ['enum value call', `fbt.enum(getValue(), ['world'])`],
    ['name gender call', `fbt.name('name', person, getGender())`],
    ['param number call', `fbt.param('name', value, {number: getNumber()})`],
    ['plural count call', `fbt.plural('world', getCount())`],
    ['pronoun gender call', `fbt.pronoun('object', getGender())`],
  ].map(([name, construct]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = fbt(['A ', <b>{${construct}}</b>], 'd');`,
  })),
  {
    name: 'subject call',
    source: `import { fbt } from 'fbtee'; const x = fbt(['A ', <b>B</b>], 'd', {subject: subjectValue()});`,
  },
  {
    name: 'unmatched sameParam',
    source: `import { fbt } from 'fbtee'; const x = fbt('A' + fbt.sameParam('missing'), 'd');`,
  },
  {
    name: 'token collision',
    source: `import { fbt } from 'fbtee'; const x = fbt(fbt.param('name', a) + fbt.param('name', b), 'd');`,
  },
  {
    name: 'common combined with desc',
    source: `import { fbt } from 'fbtee'; const x = <fbt common desc="d">A</fbt>;`,
  },
  {
    name: 'unknown JSX construct attribute',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="x" unknown="y">{x}</fbt:param></fbt>;`,
  },
  {
    name: 'invalid boolean call option',
    source: `import { fbt } from 'fbtee'; const x = fbt('A', 'd', {preserveWhitespace: 'sometimes'});`,
  },
  ...[
    [
      'functional preserveWhitespace string boolean',
      `fbt('A', 'd', {preserveWhitespace: 'true'})`,
    ],
    [
      'functional number string boolean',
      `fbt(fbt.param('x', value, {number: 'true'}), 'd')`,
    ],
    [
      'functional human string boolean',
      `fbt(fbt.pronoun('subject', gender, {human: 'true'}), 'd')`,
    ],
  ].map(([name, expression]) => ({
    name,
    source: `import { fbt } from 'fbtee'; const x = ${expression};`,
  })),
  {
    name: 'invalid boolean JSX option',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d" common="sometimes">A</fbt>;`,
  },
  {
    name: 'spread JSX options',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d" {...options}>A</fbt>;`,
  },
  {
    name: 'spread JSX child',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d">A{...children}B</fbt>;`,
  },
  {
    name: 'duplicate implicit JSX token',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><b>x</b><i>x</i></fbt>;`,
  },
  {
    name: 'variation-dependent implicit JSX token collision',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><a>world</a><b><fbt:plural count={value}>world</fbt:plural></b></fbt>;`,
  },
  {
    name: 'token collision across nested implicit phrases',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="foo">{foo}</fbt:param> <b><fbt:name name="foo" gender={gender}>{person}</fbt:name></b></fbt>;`,
  },
  {
    name: 'JSX param with multiple children',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="foo">{foo}{bar}</fbt:param></fbt>;`,
  },
  {
    name: 'JSX param with text-only child',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:param name="foo">text</fbt:param></fbt>;`,
  },
  {
    name: 'JSX name with element child',
    source: `import { fbt } from 'fbtee'; const x = <fbt desc="d"><fbt:name name="foo" gender={gender}><b>{person}</b></fbt:name></fbt>;`,
  },
];

describe('collector parity', () => {
  test.each(validFixtures)(
    'collects $name',
    ({ babelAutoImport, options, source }) => {
      if (babelAutoImport) {
        return;
      }
      assert.deepEqual(
        collectOxc(source, options),
        collectBabel(source, options),
      );
    },
  );

  test.each(invalidFixtures)('rejects $name', ({ options, source }) => {
    for (const [compiler, collect] of [
      ['babel', collectBabel],
      ['oxc', collectOxc],
    ]) {
      assert.throws(() => collect(source, options), undefined, compiler);
    }
  });

  test.each([
    {
      name: 'simple functional phrase',
      source: `import { fbt } from 'fbtee'; const value = fbt('Hello', 'greeting');`,
    },
    {
      name: 'nested JSX phrase',
      source: `import { fbt } from 'fbtee'; const value = <fbt desc="greeting">Hello <b>world</b></fbt>;`,
    },
    {
      name: 'number, plural, enum, and gender variations',
      source: `import { fbt } from 'fbtee'; const value = fbt([fbt.param('count', count, {number: true}), ' ', fbt.plural('item', count), ' ', fbt.enum(kind, {a: 'Alpha', b: 'Beta'}), ' ', fbt.name('person', person, gender)], 'inventory');`,
    },
    {
      name: 'common phrase',
      options: { fbtCommon: { Required: 'Form field requirement' } },
      source: `import { fbt } from 'fbtee'; const value = fbt.c('Required');`,
    },
  ])('$name', ({ options, source }) => {
    assert.deepEqual(
      collectOxc(source, options),
      collectBabel(source, options),
    );
  });

  test('collect CLI matches across a multi-file application', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-collector-parity-'));
    try {
      cpSync(
        new URL('../example/src', import.meta.url),
        join(directory, 'src'),
        {
          recursive: true,
        },
      );
      writeFileSync(
        join(directory, 'common.json'),
        readFileSync(
          new URL('../example/common_strings.json', import.meta.url),
        ),
      );
      const cli = fileURLToPath(
        new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
      );
      for (const compiler of ['babel', 'oxc']) {
        const result = spawnSync(
          process.execPath,
          [
            cli,
            'collect',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--common',
            './common.json',
            '--src',
            'src',
            '--out',
            `${compiler}.json`,
            '--enum-manifest',
            `${compiler}-enum.json`,
            '--packager',
            'both',
            '--no-include-default-strings',
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
      }
      assert.equal(
        readFileSync(join(directory, 'oxc.json'), 'utf8'),
        readFileSync(join(directory, 'babel.json'), 'utf8'),
      );
      assert.equal(
        readFileSync(join(directory, 'oxc-enum.json'), 'utf8'),
        readFileSync(join(directory, 'babel-enum.json'), 'utf8'),
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test.each(['text', 'phrase', 'both', 'none'])(
    'collect CLI matches custom hash, extra options, and the %s packager',
    (packager) => {
      const directory = mkdtempSync(join(tmpdir(), 'fbtee-collector-options-'));
      try {
        writeFileSync(
          join(directory, 'source.jsx'),
          `import { fbt } from 'fbtee';
         export const value = fbt('A', 'd', {locale: 'en'});
         export const whitespace = <fbt desc="w" preserveWhitespace>A  B</fbt>;
         export const varied = fbt('S', 'subject', {subject});`,
        );
        writeFileSync(
          join(directory, 'hash.mjs'),
          `export default (text, desc) => text + '::' + desc;`,
        );
        const cli = fileURLToPath(
          new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
        );
        for (const compiler of ['babel', 'oxc']) {
          const result = spawnSync(
            process.execPath,
            [
              cli,
              'collect',
              ...(compiler === 'oxc' ? ['--oxc'] : []),
              '--src',
              'source.jsx',
              '--out',
              `${compiler}.json`,
              '--enum-manifest',
              `${compiler}-enum.json`,
              '--hash-module',
              './hash.mjs',
              '--packager',
              packager,
              '--options',
              'locale',
              '--no-include-default-strings',
            ],
            { cwd: directory, encoding: 'utf8' },
          );
          assert.equal(
            result.status,
            0,
            `${compiler}: ${result.stderr || result.stdout}`,
          );
        }
        assert.equal(
          readFileSync(join(directory, 'oxc.json'), 'utf8'),
          readFileSync(join(directory, 'babel.json'), 'utf8'),
        );
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
  );

  test.each(['text', 'phrase', 'both', 'none'])(
    'collect CLI matches the %s packager and legacy format',
    (packager) => {
      const directory = mkdtempSync(join(tmpdir(), 'fbtee-packager-parity-'));
      try {
        writeFileSync(
          join(directory, 'source.jsx'),
          `import { fbt } from 'fbtee'; export const value = <fbt desc="d">A <b>B</b></fbt>;`,
        );
        const cli = fileURLToPath(
          new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
        );
        for (const compiler of ['babel', 'oxc']) {
          const result = spawnSync(
            process.execPath,
            [
              cli,
              'collect',
              ...(compiler === 'oxc' ? ['--oxc'] : []),
              '--src',
              'source.jsx',
              '--out',
              `${compiler}.json`,
              '--enum-manifest',
              `${compiler}-enum.json`,
              '--packager',
              packager,
              '--legacy-format',
              '--no-include-default-strings',
            ],
            { cwd: directory, encoding: 'utf8' },
          );
          assert.equal(
            result.status,
            0,
            `${compiler}: ${result.stderr || result.stdout}`,
          );
        }
        assert.equal(
          readFileSync(join(directory, 'oxc.json'), 'utf8'),
          readFileSync(join(directory, 'babel.json'), 'utf8'),
        );
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
  );
});

describe('native CLI parity', () => {
  test.each([
    { arguments: [], name: 'root help' },
    { arguments: ['unknown-command'], name: 'unknown command' },
  ])('matches $name behavior', ({ arguments: cliArguments }) => {
    const cli = fileURLToPath(
      new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
    );
    const babel = spawnSync(process.execPath, [cli, ...cliArguments], {
      encoding: 'utf8',
    });
    const oxc = spawnSync(process.execPath, [cli, ...cliArguments, '--oxc'], {
      encoding: 'utf8',
    });
    assert.equal(oxc.status, babel.status);
    assert.equal(oxc.stdout, babel.stdout);
    assert.equal(oxc.stderr, babel.stderr);
  });

  test.each([
    'collect',
    'translate',
    'prepare-translations',
    'migrate-locales',
  ])('%s help is byte-identical', (command) => {
    const cli = fileURLToPath(
      new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
    );
    const babel = spawnSync(process.execPath, [cli, command, '--help'], {
      encoding: 'utf8',
    });
    const oxc = spawnSync(process.execPath, [cli, command, '--oxc', '--help'], {
      encoding: 'utf8',
    });
    assert.equal(oxc.status, babel.status);
    assert.equal(oxc.stdout, babel.stdout);
    assert.equal(oxc.stderr, babel.stderr);
  });

  test.each([
    ['--custom-collector', './collector.mjs'],
    ['--transform', './transform.mjs'],
    ['--generate-fbt-nodes'],
  ])('collect rejects Babel-specific extension %s', (...extensionArguments) => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
        ),
        'collect',
        '--oxc',
        ...extensionArguments,
      ],
      { encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(extensionArguments[0]));
  });

  test('collect refuses to silently ignore Babel configuration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-babel-config-'));
    try {
      mkdirSync(join(directory, 'src', 'nested'), { recursive: true });
      writeFileSync(
        join(directory, 'src', 'nested', '.babelrc.cjs'),
        `module.exports = {
          plugins: [() => ({
            visitor: {
              Program(path) {
                path.traverse({
                  StringLiteral(stringPath) {
                    if (stringPath.node.value === 'Before') {
                      stringPath.node.value = 'After';
                    }
                  },
                });
              },
            },
          })],
        };`,
      );
      writeFileSync(
        join(directory, 'src', 'nested', 'source.jsx'),
        `import { fbt } from 'fbtee'; export const value = fbt('Before', 'd');`,
      );
      const cli = fileURLToPath(
        new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
      );
      const native = spawnSync(
        process.execPath,
        [
          cli,
          'collect',
          '--oxc',
          '--src',
          'src',
          '--no-include-default-strings',
        ],
        { cwd: directory, encoding: 'utf8' },
      );
      assert.notEqual(native.status, 0);
      assert.match(native.stderr, /cannot execute Babel configuration/);

      for (const [compiler, extraArguments] of [
        ['babel', []],
        ['oxc', ['--oxc', '--disable-babel-config']],
      ]) {
        const result = spawnSync(
          process.execPath,
          [
            cli,
            'collect',
            ...extraArguments,
            '--src',
            'src',
            '--out',
            `${compiler}.json`,
            '--enum-manifest',
            `${compiler}-enum.json`,
            '--no-include-default-strings',
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(result.status, 0, result.stderr || result.stdout);
      }
      assert.equal(
        JSON.parse(readFileSync(join(directory, 'babel.json'))).phrases[0].jsfbt
          .t.text,
        'After',
      );
      assert.equal(
        JSON.parse(readFileSync(join(directory, 'oxc.json'))).phrases[0].jsfbt.t
          .text,
        'Before',
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test('collect refuses to silently ignore .babelignore', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-babel-ignore-'));
    try {
      writeFileSync(join(directory, '.babelignore'), 'source.jsx\n');
      writeFileSync(
        join(directory, 'source.jsx'),
        `import { fbt } from 'fbtee'; export const value = fbt('Ignored', 'd');`,
      );
      const cli = fileURLToPath(
        new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
      );
      const guarded = spawnSync(
        process.execPath,
        [
          cli,
          'collect',
          '--oxc',
          '--src',
          'source.jsx',
          '--no-include-default-strings',
        ],
        { cwd: directory, encoding: 'utf8' },
      );
      assert.notEqual(guarded.status, 0);
      assert.match(guarded.stderr, /\.babelignore/);

      const bypassed = spawnSync(
        process.execPath,
        [
          cli,
          'collect',
          '--oxc',
          '--disable-babel-config',
          '--src',
          'source.jsx',
          '--out',
          'oxc.json',
          '--enum-manifest',
          'oxc-enum.json',
          '--no-include-default-strings',
        ],
        { cwd: directory, encoding: 'utf8' },
      );
      assert.equal(bypassed.status, 0, bypassed.stderr || bypassed.stdout);
      assert.equal(
        JSON.parse(readFileSync(join(directory, 'oxc.json'))).phrases.length,
        1,
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test.each([
    { arguments: ['--no-jenkins'], name: 'indexed stdin output' },
    {
      arguments: ['--no-jenkins', '--hash-module', './hash.mjs'],
      name: 'custom-hashed stdin output',
    },
  ])('translate matches $name', ({ arguments: extraArguments }) => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-translate-stdin-'));
    try {
      writeFileSync(
        join(directory, 'hash.mjs'),
        `export default (table) => 'custom-' + table.text;`,
      );
      const input = JSON.stringify({
        phrases: [
          {
            hashToLeaf: { hash: { desc: 'd', text: 'A' } },
            jsfbt: { m: [], t: { desc: 'd', text: 'A' } },
            project: '',
          },
        ],
        translationGroups: [
          {
            'fb-locale': 'de_DE',
            translations: {
              hash: {
                tokens: [],
                translations: [{ translation: 'Ein A', variations: [] }],
                types: [],
              },
            },
          },
        ],
      });
      const outputs = [];
      for (const compiler of ['babel', 'oxc']) {
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'translate',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--stdin',
            ...extraArguments,
          ],
          { cwd: directory, encoding: 'utf8', input },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
        outputs.push(result.stdout);
      }
      assert.equal(outputs[1], outputs[0]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test.each([
    ['string entry', 'Generated'],
    ['empty object', {}],
    ['missing translations', { tokens: [], types: [] }],
    ['incorrect collection types', { tokens: {}, translations: {}, types: {} }],
  ])('translate rejects malformed %s', (_name, malformedTranslation) => {
    const input = JSON.stringify({
      phrases: [
        {
          hashToLeaf: { hash: { desc: 'd', text: 'Source' } },
          jsfbt: { m: [], t: { desc: 'd', text: 'Source' } },
          project: '',
        },
      ],
      translationGroups: [
        {
          'fb-locale': 'fb_HX',
          translations: { hash: malformedTranslation },
        },
      ],
    });
    for (const compiler of ['babel', 'oxc']) {
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
          ),
          'translate',
          ...(compiler === 'oxc' ? ['--oxc'] : []),
          '--stdin',
          '--no-jenkins',
        ],
        { encoding: 'utf8', input },
      );
      assert.notEqual(result.status, 0, compiler);
    }
  });

  test.each([
    { arguments: [], succeeds: true },
    { arguments: ['--strict'], succeeds: false },
  ])(
    'translate matches missing-translation handling ($arguments)',
    ({ arguments: extraArguments, succeeds }) => {
      const input = JSON.stringify({
        phrases: [
          {
            hashToLeaf: { hash: { desc: 'd', text: 'Source' } },
            jsfbt: { m: [], t: { desc: 'd', text: 'Source' } },
            project: '',
          },
        ],
        translationGroups: [
          { 'fb-locale': 'de_DE', translations: { hash: null } },
        ],
      });
      const results = ['babel', 'oxc'].map((compiler) =>
        spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'translate',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--stdin',
            ...extraArguments,
          ],
          { encoding: 'utf8', input },
        ),
      );
      for (const result of results) {
        assert.equal(result.status === 0, succeeds, result.stderr);
      }
      if (succeeds) {
        assert.equal(results[1].stdout, results[0].stdout);
        assert.equal(results[1].stderr, results[0].stderr);
      }
    },
  );

  test('translate matches every example locale', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-translate-parity-'));
    try {
      writeFileSync(
        join(directory, 'source_strings.json'),
        readFileSync(
          new URL('../example/source_strings.json', import.meta.url),
        ),
      );
      cpSync(
        new URL('../example/translations', import.meta.url),
        join(directory, 'translations'),
        { recursive: true },
      );
      for (const compiler of ['babel', 'oxc']) {
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'translate',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--source-strings',
            'source_strings.json',
            '--translations',
            ...readdirSync(join(directory, 'translations')).map((file) =>
              join('translations', file),
            ),
            '--output-dir',
            compiler,
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
      }
      const files = globSyncForTest(join(directory, 'babel'));
      assert.equal(
        files.join(','),
        globSyncForTest(join(directory, 'oxc')).join(','),
      );
      for (const file of files) {
        assert.equal(
          readFileSync(join(directory, 'oxc', file), 'utf8'),
          readFileSync(join(directory, 'babel', file), 'utf8'),
          file,
        );
      }
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test.each([
    ['bcp47', 'es-419.json'],
    ['legacy', 'es_LA.json'],
    ['preserve', 'es_LA.json'],
  ])(
    'translate matches new %s output locale files',
    (localeStyle, expectedFile) => {
      const directory = mkdtempSync(join(tmpdir(), 'fbtee-translate-locale-'));
      try {
        writeFileSync(
          join(directory, 'source_strings.json'),
          JSON.stringify({
            phrases: [
              {
                hashToLeaf: { hash: { desc: 'd', text: 'A' } },
                jsfbt: { m: [], t: { desc: 'd', text: 'A' } },
                project: '',
              },
            ],
          }),
        );
        writeFileSync(
          join(directory, 'translation.json'),
          JSON.stringify({
            'fb-locale': 'es_LA',
            translations: {
              hash: {
                tokens: [],
                translations: [{ translation: 'Un A', variations: {} }],
                types: [],
              },
            },
          }),
        );
        for (const compiler of ['babel', 'oxc']) {
          const result = spawnSync(
            process.execPath,
            [
              fileURLToPath(
                new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
              ),
              'translate',
              ...(compiler === 'oxc' ? ['--oxc'] : []),
              '--source-strings',
              'source_strings.json',
              '--translations',
              'translation.json',
              '--output-dir',
              compiler,
              '--output-locale-style',
              localeStyle,
            ],
            { cwd: directory, encoding: 'utf8' },
          );
          assert.equal(
            result.status,
            0,
            `${compiler}: ${result.stderr || result.stdout}`,
          );
        }
        assert.equal(
          globSyncForTest(join(directory, 'babel')).join(','),
          expectedFile,
        );
        assert.equal(
          readFileSync(join(directory, 'oxc', expectedFile), 'utf8'),
          readFileSync(join(directory, 'babel', expectedFile), 'utf8'),
        );
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
  );

  test('prepare-translations matches existing locale files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-prepare-parity-'));
    try {
      writeFileSync(
        join(directory, 'source_strings.json'),
        readFileSync(
          new URL('../example/source_strings.json', import.meta.url),
        ),
      );
      for (const compiler of ['babel', 'oxc']) {
        cpSync(
          new URL('../example/translations', import.meta.url),
          join(directory, compiler),
          { recursive: true },
        );
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'prepare-translations',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--source-strings',
            'source_strings.json',
            '--output-dir',
            compiler,
            '--sort-by-hash',
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
      }
      const files = globSyncForTest(join(directory, 'babel'));
      assert.deepEqual(files, globSyncForTest(join(directory, 'oxc')));
      for (const file of files) {
        assert.equal(
          readFileSync(join(directory, 'oxc', file), 'utf8'),
          readFileSync(join(directory, 'babel', file), 'utf8'),
          file,
        );
      }
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test.each([
    ['bcp47', 'es-419.json'],
    ['legacy', 'es_LA.json'],
    ['preserve', 'es_LA.json'],
  ])(
    'prepare-translations matches new %s locale files',
    (localeStyle, expectedFile) => {
      const directory = mkdtempSync(join(tmpdir(), 'fbtee-prepare-new-'));
      try {
        writeFileSync(
          join(directory, 'source_strings.json'),
          JSON.stringify({
            phrases: [
              {
                hashToLeaf: { hash: { desc: 'Description', text: 'Text' } },
              },
            ],
          }),
        );
        for (const compiler of ['babel', 'oxc']) {
          mkdirSync(join(directory, compiler));
          const result = spawnSync(
            process.execPath,
            [
              fileURLToPath(
                new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
              ),
              'prepare-translations',
              ...(compiler === 'oxc' ? ['--oxc'] : []),
              '--source-strings',
              'source_strings.json',
              '--output-dir',
              compiler,
              '--locales',
              'es_LA',
              '--output-locale-style',
              localeStyle,
            ],
            { cwd: directory, encoding: 'utf8' },
          );
          assert.equal(
            result.status,
            0,
            `${compiler}: ${result.stderr || result.stdout}`,
          );
        }
        assert.equal(
          globSyncForTest(join(directory, 'babel')).join(','),
          expectedFile,
        );
        assert.equal(
          readFileSync(join(directory, 'oxc', expectedFile), 'utf8'),
          readFileSync(join(directory, 'babel', expectedFile), 'utf8'),
        );
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
  );

  test('prepare-translations preserves falsy existing entries', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-prepare-falsy-'));
    try {
      writeFileSync(
        join(directory, 'source_strings.json'),
        JSON.stringify({
          phrases: [
            {
              hashToLeaf: {
                existing: { desc: 'Description', text: 'Text' },
              },
            },
          ],
        }),
      );
      for (const compiler of ['babel', 'oxc']) {
        const outputDirectory = join(directory, compiler);
        mkdirSync(outputDirectory);
        writeFileSync(
          join(outputDirectory, 'en-US.json'),
          JSON.stringify({
            'fb-locale': 'en-US',
            translations: {
              existing: null,
              removed: null,
              removedTruthy: { status: 'done' },
            },
          }),
        );
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'prepare-translations',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--source-strings',
            'source_strings.json',
            '--output-dir',
            compiler,
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
      }
      assert.equal(
        readFileSync(join(directory, 'oxc', 'en-US.json'), 'utf8'),
        readFileSync(join(directory, 'babel', 'en-US.json'), 'utf8'),
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test('migrate-locales matches locale filenames and JSON', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fbtee-migrate-parity-'));
    try {
      for (const compiler of ['babel', 'oxc']) {
        const outputDirectory = join(directory, compiler);
        mkdirSync(outputDirectory);
        for (const [locale, text] of [
          ['de_DE', 'Text'],
          ['es_LA', 'Texto'],
        ]) {
          writeFileSync(
            join(outputDirectory, `${locale}.json`),
            JSON.stringify(
              {
                'fb-locale': locale,
                [locale]: { hash: text },
                ...(locale === 'de_DE'
                  ? { de: { hash: 'Base language text' } }
                  : {}),
                metadata: true,
              },
              null,
              2,
            ),
          );
        }
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL('../packages/fbtee-cli/bin.mjs', import.meta.url),
            ),
            'migrate-locales',
            ...(compiler === 'oxc' ? ['--oxc'] : []),
            '--dir',
            compiler,
            '--to',
            'bcp47',
          ],
          { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(
          result.status,
          0,
          `${compiler}: ${result.stderr || result.stdout}`,
        );
      }
      const files = globSyncForTest(join(directory, 'babel'));
      assert.equal(files.join(','), 'de-DE.json,es-419.json');
      assert.equal(
        files.join(','),
        globSyncForTest(join(directory, 'oxc')).join(','),
      );
      for (const file of files) {
        assert.equal(
          readFileSync(join(directory, 'oxc', file), 'utf8'),
          readFileSync(join(directory, 'babel', file), 'utf8'),
          file,
        );
      }
      const migratedGerman = JSON.parse(
        readFileSync(join(directory, 'oxc', 'de-DE.json'), 'utf8'),
      );
      assert.deepEqual(migratedGerman.de, { hash: 'Base language text' });
      assert.deepEqual(migratedGerman['de-DE'], { hash: 'Text' });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

const globSyncForTest = (directory) =>
  readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort();

describe('invalid compiler input', () => {
  test.each(invalidFixtures)('$name', (fixture) => {
    for (const compiler of Object.keys(compilers)) {
      assert.throws(
        () => compilers[compiler](fixture.source, fixture.options),
        `${compiler.toUpperCase()} must reject this fixture`,
      );
    }
  });
});
