import FbtResultBase from './FbtResultBase.tsx';
import {
  IFbtErrorListener,
  IFbtResultBase,
  NestedFbtContentItems,
} from './Types.tsx';

type Props = Readonly<{
  content: NestedFbtContentItems;
}>;

export default class FbtResult extends FbtResultBase implements IFbtResultBase {
  $$typeof = Symbol.for('react.transitional.element');
  props: Props;
  ref = null;
  type = ({ content }: Props): NestedFbtContentItems => content;

  constructor(
    contents: NestedFbtContentItems,
    errorListener: IFbtErrorListener | null,
    public readonly key: string | null | undefined
  ) {
    super(contents, errorListener);
    this.props = {
      content: contents,
    };
  }
}
