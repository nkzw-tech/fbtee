import { ModuleNameRegExp } from '../FbtConstants';

describe('FbtConstants', () => {
  describe('ModuleNameRegExp', () => {
    it('should allow common fbt/fbs code patterns', () => {
      const scenarios = [
        `<fbt desc="..."`,
        `fbt(foo)`,
        `fbt.c(foo)`,

        `<fbs desc="..."`,
        `fbs(foo)`,
        `fbs.c(foo)`,
      ];

      for (const scenario of scenarios) {
        expect(scenario).toMatch(ModuleNameRegExp);
      }
    });

    it('should reject code patterns resembling fbt/fbs', () => {
      const scenarios = [
        `<FbTask desc="..."`,
        `fbsource(foo)`,
        `fbt.toString()`,
        `fbs.toString()`,
        `const a: Fbt = ...`,
        `const a: Fbs = ...`,
      ];

      for (const scenario of scenarios) {
        expect(scenario).not.toMatch(ModuleNameRegExp);
      }
    });
  });
});
