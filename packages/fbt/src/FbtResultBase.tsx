/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow
 */

import {
  FbtContentItem,
  IFbtErrorListener,
  IFbtResultBase,
  NestedFbtContentItems,
} from './Types';

export default class FbtResultBase implements IFbtResultBase {
  _contents: NestedFbtContentItems;
  _stringValue: string | null | undefined;
  _isSerializing: boolean;
  _errorListener: IFbtErrorListener | null | undefined;

  constructor(
    contents: NestedFbtContentItems,
    errorListener?: IFbtErrorListener | null
  ) {
    this._contents = contents;
    this._errorListener = errorListener;
    this._isSerializing = false;
    this._stringValue = null;
  }

  flattenToArray(): Array<FbtContentItem> {
    return FbtResultBase.flattenToArray(this._contents);
  }

  getContents(): NestedFbtContentItems {
    return this._contents;
  }

  toString(): string {
    // Prevent risk of infinite recursions if the error listener or nested contents toString()
    // reenters this method on the same instance
    if (this._isSerializing) {
      return '<<Reentering fbt.toString() is forbidden>>';
    }
    this._isSerializing = true;
    try {
      return this._toString();
    } finally {
      this._isSerializing = false;
    }
  }

  _toString(): string {
    if (this._stringValue != null) {
      return this._stringValue;
    }
    let stringValue = '';
    for (const content of this.flattenToArray()) {
      if (typeof content === 'string' || content instanceof FbtResultBase) {
        stringValue += content.toString();
      } else {
        this._errorListener?.onStringSerializationError?.(content);
      }
    }
    this._stringValue = stringValue;
    return stringValue;
  }

  toJSON(): string {
    return this.toString();
  }

  static flattenToArray(
    contents: NestedFbtContentItems
  ): Array<FbtContentItem> {
    const result: Array<FbtContentItem> = [];
    for (const content of contents) {
      if (Array.isArray(content)) {
        result.push.apply(result, FbtResultBase.flattenToArray(content));
      } else if (content instanceof FbtResultBase) {
        result.push.apply(result, content.flattenToArray());
      } else {
        result.push(content as FbtContentItem);
      }
    }
    return result;
  }
}
