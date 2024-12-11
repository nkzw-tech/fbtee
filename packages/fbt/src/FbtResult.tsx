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

const injectReactShim = (fbtResult: IFbtResultBase) => {
  const reactObj = { validated: true } as const;

  if (process.env.NODE_ENV === 'development') {
    Object.defineProperty(fbtResult, '_store', {
      configurable: false,
      enumerable: false,
      value: reactObj,
      writable: false,
    });
  } else {
    fbtResult._store = reactObj;
  }
};

export default class FbtResult extends FbtResultBase implements IFbtResultBase {
  $$typeof: symbol | number = Symbol.for('react.transitional.element');
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
      injectReactShim(this);
    }
  }
}
