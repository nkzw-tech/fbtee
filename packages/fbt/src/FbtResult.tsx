import type { FbtResolvedPayload } from './FbtHooks.tsx';
import FbtReactUtil from './FbtReactUtil.tsx';
import FbtResultBase from './FbtResultBase.tsx';
import {
  IFbtErrorListener,
  IFbtResultBase,
  NestedFbtContentItems,
} from './Types.tsx';

const FbtResultComponent = (props: Props): NestedFbtContentItems =>
  props.content;

type Props = Readonly<{
  content: NestedFbtContentItems;
}>;

export default class FbtResult extends FbtResultBase implements IFbtResultBase {
  $$typeof: symbol | number = FbtReactUtil.REACT_ELEMENT_TYPE;
  key: string | null | undefined = null;
  props: Props;
  ref = null;
  type: (props: Props) => NestedFbtContentItems = FbtResultComponent;

  constructor(
    contents: NestedFbtContentItems,
    errorListener?: IFbtErrorListener | null
  ) {
    super(contents, errorListener);
    this.props = {
      content: contents,
    };

    if (process.env.NODE_ENV === 'development') {
      FbtReactUtil.injectReactShim(this);
    }
  }

  static get(input: FbtResolvedPayload): FbtResult {
    return new FbtResult(input.contents, input.errorListener);
  }
}
