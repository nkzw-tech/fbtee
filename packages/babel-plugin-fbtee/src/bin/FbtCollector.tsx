import type { PluginItem } from '@babel/core';
import { transformSync } from '@babel/core';
import babelPluginSyntaxDecorators from '@babel/plugin-syntax-decorators';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';
import fbtAutoImport from '@nkzw/babel-plugin-fbtee-auto-import';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode.tsx';
import { FbtCommonMap } from '../FbtCommon.tsx';
import type { FbtOptionConfig } from '../FbtConstants.tsx';
import type { EnumManifest } from '../FbtEnumRegistrar.tsx';
import { textContainsFbtLikeModule } from '../FbtUtil.tsx';
import type { Phrase, PluginOptions } from '../index.tsx';
import fbt, {
  getChildToParentRelationships,
  getExtractedStrings,
  getFbtElementNodes,
} from '../index.tsx';
import type { PatternHash, PatternString } from '../Types.ts';

export type ExternalTransform = (
  src: string,
  opts: PluginOptions,
  filename?: string | null,
) => unknown;
export type CollectorConfig = {
  disableBabelConfig?: boolean;
  fbtCommon?: FbtCommonMap | null;
  generateOuterTokenName?: boolean;
  plugins?: ReadonlyArray<PluginItem>;
  presets?: ReadonlyArray<PluginItem>;
  transform?: ExternalTransform | null;
};
type ParentPhraseIndex = number;
export type ChildParentMappings = Map<number, ParentPhraseIndex>;
export type RawChildParentMappings = Record<string, number>;

export type HashToLeaf = Partial<
  Record<
    PatternHash,
    {
      desc: string;
      text: PatternString;
    }
  >
>;
export type PackagerPhrase = Phrase & {
  hash_code?: number;
  hash_key?: string;
  hashToLeaf?: HashToLeaf;
};

export interface IFbtCollector {
  collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest,
  ): Promise<void>;
  collectFromOneFile(
    source: string,
    filename: string,
    fbtEnumManifest?: EnumManifest,
  ): Promise<void>;
  getChildParentMappings(): ChildParentMappings;
  getFbtElementNodes(): Array<PlainFbtNode>;
  getPhrases(): Array<PackagerPhrase>;
}

const transform = (
  code: string,
  options: { disableBabelConfig: boolean; filename: string | null },
  plugins: ReadonlyArray<PluginItem>,
  presets: ReadonlyArray<PluginItem>,
) => {
  transformSync(code, {
    ast: false,
    code: false,
    configFile: !options.disableBabelConfig,
    filename: options.filename,
    plugins: [
      fbtAutoImport,
      [fbt, options],
      ...(options.disableBabelConfig
        ? [[babelPluginSyntaxDecorators, { version: '2023-11' }]]
        : []),
      ...plugins,
    ],
    presets: [
      presetTypescript,
      [
        presetReact,
        {
          runtime: 'automatic',
        },
      ],
      ...presets,
    ],
    sourceType: 'unambiguous',
  });
};

export default class FbtCollector implements IFbtCollector {
  _phrases: Array<PackagerPhrase> = [];
  _childParentMappings: ChildParentMappings = new Map();

  constructor(
    private readonly config: CollectorConfig,
    private readonly extraOptions: FbtOptionConfig,
  ) {}

  async collectFromOneFile(
    source: string,
    filename: string,
    fbtEnumManifest?: EnumManifest,
  ): Promise<void> {
    const options = {
      collectFbt: true,
      disableBabelConfig: !!this.config.disableBabelConfig,
      extraOptions: this.extraOptions,
      fbtCommon: this.config.fbtCommon,
      fbtEnumManifest,
      filename,
      generateOuterTokenName: this.config.generateOuterTokenName,
    } as const;

    if (!textContainsFbtLikeModule(source)) {
      return;
    }

    const externalTransform = this.config.transform;
    if (externalTransform) {
      externalTransform(source, options, filename);
    } else {
      transform(
        source,
        options,
        this.config.plugins || [],
        this.config.presets || [],
      );
    }

    const newPhrases = getExtractedStrings();
    const newChildParentMappings = getChildToParentRelationships();
    const offset = this._phrases.length;
    for (const [childIndex, parentIndex] of newChildParentMappings) {
      this._childParentMappings.set(offset + childIndex, offset + parentIndex);
    }

    // PackagerPhrase is an extended type of Phrase
    this._phrases.push(...(newPhrases as Array<PackagerPhrase>));
  }

  async collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest,
  ) {
    await Promise.all(
      files.map(([file, source]) =>
        this.collectFromOneFile(source, file, fbtEnumManifest),
      ),
    );
  }

  getPhrases(): Array<PackagerPhrase> {
    return this._phrases;
  }

  getChildParentMappings(): ChildParentMappings {
    return this._childParentMappings;
  }

  getFbtElementNodes(): Array<PlainFbtNode> {
    return getFbtElementNodes();
  }
}
