import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('FixedLocaleContext: babel plugin locale override injection', () => {
  describe('component detection (name starts with uppercase)', () => {
    it('should inject __fbtLocaleOverride in a named function component', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function MyComponent() {
              return fbt("Hello", "greeting");
            }
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should inject __fbtLocaleOverride in an arrow function component', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            const MyComponent = () => {
              return fbt("Hello", "greeting");
            };
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should inject __fbtLocaleOverride in a function expression component', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            const MyComponent = function() {
              return fbt("Hello", "greeting");
            };
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('hook detection (name starts with use)', () => {
    it('should inject __fbtLocaleOverride in a custom hook', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function useGreeting() {
              return fbt("Hello", "greeting");
            }
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('non-component functions', () => {
    it('should NOT inject __fbtLocaleOverride in a regular function', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function formatMessage() {
              return fbt("Hello", "greeting");
            }
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should NOT inject __fbtLocaleOverride in a top-level fbt call', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            const greeting = fbt("Hello", "greeting");
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('fbs support', () => {
    it('should inject __fbtLocaleOverride for fbs calls in a component', () => {
      expect(
        snapshotTransform(`
          import { fbs } from "fbtee";
          function MyComponent() {
            return fbs("Hello", "greeting");
          }
        `),
      ).toMatchSnapshot();
    });

    it('should inject once for mixed fbt and fbs calls', () => {
      expect(
        snapshotTransform(`
          import { fbt, fbs } from "fbtee";
          function MyComponent() {
            const label = fbs("label", "desc");
            return fbt("Hello", "greeting");
          }
        `),
      ).toMatchSnapshot();
    });
  });

  describe('forwardRef and memo', () => {
    it('should inject in React.forwardRef callback', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            import React from "react";
            const MyComponent = React.forwardRef(function(props, ref) {
              return fbt("Hello", "greeting");
            });
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should inject in React.memo callback', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            import React from "react";
            const MyComponent = React.memo(function() {
              return fbt("Hello", "greeting");
            });
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('fourth argument passing', () => {
    it('should pass __fbtLocaleOverride as 4th argument to fbt._ calls', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function MyComponent() {
              return <fbt desc="greeting">Hello World</fbt>;
            }
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should pass __fbtLocaleOverride to all fbt._ calls in a component', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function MyComponent() {
              const a = fbt("First", "desc1");
              const b = fbt("Second", "desc2");
              return a + b;
            }
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('no fbt calls', () => {
    it('should NOT inject when function has no fbt calls', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            function MyComponent() {
              return "no fbt here";
            }
          `),
        ),
      ).toMatchSnapshot();
    });
  });
});
