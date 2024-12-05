import { IFbtResultBase } from './Types';

const REACT_ELEMENT_TYPE: symbol | 60103 =
  (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.element')) ||
  0xeac7;

export default {
  REACT_ELEMENT_TYPE,

  injectReactShim(fbtResult: IFbtResultBase) {
    const reactObj = { validated: true } as const;

    if (process.env.NODE_ENV === 'development') {
      Object.defineProperty(fbtResult, '_store', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: reactObj,
      });
    } else {
      fbtResult._store = reactObj;
    }
  },
};
