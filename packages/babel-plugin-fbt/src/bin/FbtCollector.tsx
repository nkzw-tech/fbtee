import type { PluginItem } from '@babel/core';
import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';
import type { PatternHash, PatternString } from '../../../fbt/src/FbtTable';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode';
import type { FbtOptionConfig } from '../FbtConstants';
import type { EnumManifest } from '../FbtEnumRegistrar';
import { textContainsFbtLikeModule } from '../FbtUtil';
import type { Phrase, PluginOptions } from '../index';
import fbt, {
  getChildToParentRelationships,
  getExtractedStrings,
  getFbtElementNodes,
} from '../index';

export type ExternalTransform = (
  src: string,
  opts: PluginOptions,
  filename?: string | null | undefined
) => unknown;
export type CollectorConfig = {
  fbtCommonPath?: string;
  plugins?: ReadonlyArray<PluginItem>;
  presets?: ReadonlyArray<PluginItem>;
  transform?: ExternalTransform | null | undefined;
  generateOuterTokenName?: boolean;
};
type ParentPhraseIndex = number;
export type ChildParentMappings = {
  [childPhraseIndex: number]: ParentPhraseIndex;
};
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
  collectFromOneFile(
    source: string,
    filename: string,
    fbtEnumManifest?: EnumManifest
  ): Promise<void>;
  collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest
  ): Promise<void>;
  getChildParentMappings(): ChildParentMappings;
  getFbtElementNodes(): Array<PlainFbtNode>;
  getPhrases(): Array<PackagerPhrase>;
}

const transform = (
  code: string,
  options: { filename: string | null | undefined },
  plugins: ReadonlyArray<PluginItem>,
  presets: ReadonlyArray<PluginItem>
) => {
  transformSync(code, {
    ast: false,
    code: false,
    filename: options.filename,
    plugins: [[fbt, options], ...plugins],
    presets: [presetTypescript, presetReact, ...presets],
    sourceType: 'unambiguous',
  });
};

export default class FbtCollector implements IFbtCollector {
  _phrases: Array<PackagerPhrase>;
  _childParentMappings: ChildParentMappings;
  _extraOptions: FbtOptionConfig;
  _config: CollectorConfig;

  constructor(config: CollectorConfig, extraOptions: FbtOptionConfig) {
    this._phrases = [];
    this._childParentMappings = {};
    this._extraOptions = extraOptions;
    this._config = config;
  }

  async collectFromOneFile(
    source: string,
    filename: string,
    fbtEnumManifest?: EnumManifest
  ): Promise<void> {
    const options = {
      collectFbt: true,
      extraOptions: this._extraOptions,
      fbtCommonPath: this._config.fbtCommonPath,
      fbtEnumManifest,
      filename,
      generateOuterTokenName: this._config.generateOuterTokenName,
    } as const;

    if (!textContainsFbtLikeModule(source)) {
      return;
    }

    const externalTransform = this._config.transform;
    if (externalTransform) {
      externalTransform(source, options, filename);
    } else {
      transform(
        source,
        options,
        this._config.plugins || [],
        this._config.presets || []
      );
    }

    let newPhrases = getExtractedStrings();
    const newChildParentMappings = getChildToParentRelationships();
    const offset = this._phrases.length;
    Object.entries(newChildParentMappings).forEach(
      ([childIndex, parentIndex]: [any, any]) => {
        this._childParentMappings[offset + +childIndex] = offset + parentIndex;
      }
    );

    // PackagerPhrase is an extended type of Phrase
    this._phrases.push(...(newPhrases as Array<PackagerPhrase>));
  }

  async collectFromFiles(
    files: Array<[string, string]>,
    fbtEnumManifest?: EnumManifest
  ) {
    await Promise.all(
      files.map(([file, source]: [any, any]) =>
        this.collectFromOneFile(source, file, fbtEnumManifest)
      )
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
