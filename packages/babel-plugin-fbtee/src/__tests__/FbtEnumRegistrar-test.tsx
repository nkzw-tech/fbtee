import { describe, expect, it } from '@jest/globals';
import FbtEnumRegistrar from '../FbtEnumRegistrar.tsx';

describe('Test FbtEnumRegistrar', () => {
  it('should strip paths and extensions', () => {
    FbtEnumRegistrar.setModuleAlias('qux', '/foo/bar/baz$FbtEnum.js');
    expect(FbtEnumRegistrar.getModuleName('qux')).toBe('baz$FbtEnum');

    FbtEnumRegistrar.setModuleAlias('foo', './abc$FbtEnum');
    expect(FbtEnumRegistrar.getModuleName('foo')).toBe('abc$FbtEnum');

    FbtEnumRegistrar.setModuleAlias(
      'bar',
      '../some/../redundant/../path/xyz$FbtEnum',
    );
    expect(FbtEnumRegistrar.getModuleName('bar')).toBe('xyz$FbtEnum');
  });

  it("should not register modules that aren't enums", () => {
    FbtEnumRegistrar.setModuleAlias('xyz', './abc');
    expect(FbtEnumRegistrar.getModuleName('xyz')).toBe(null);
  });
});
