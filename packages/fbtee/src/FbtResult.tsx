import FbtResultBase from './FbtResultBase.tsx';
import type {
  BaseResult,
  IFbtErrorListener,
  NestedFbtContentItems,
} from './Types.ts';

type Props = Readonly<{
  content: NestedFbtContentItems;
}>;

export default class FbtResult extends FbtResultBase implements BaseResult {
  $$typeof = Symbol.for('react.transitional.element');
  props: Props;
  ref = null;
  type = ({ content }: Props): NestedFbtContentItems => content;

  constructor(
    contents: NestedFbtContentItems,
    errorListener: IFbtErrorListener | null,
    public readonly key: string | null | undefined,
  ) {
    super(contents, errorListener);
    this.props = {
      content: contents,
    };
  }
}
