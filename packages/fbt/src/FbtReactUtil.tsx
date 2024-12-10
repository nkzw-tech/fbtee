import { IFbtResultBase } from './Types';

const REACT_ELEMENT_TYPE: symbol | 60_103 =
  (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.element')) ||
  0xea_c7;

export default {
  REACT_ELEMENT_TYPE,

  injectReactShim(fbtResult: IFbtResultBase) {
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
  },
};
