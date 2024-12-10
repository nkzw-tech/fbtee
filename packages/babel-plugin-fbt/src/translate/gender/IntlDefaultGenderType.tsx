import { Gender } from '../IntlVariations.tsx';

export function getFallback(): typeof Gender.UNKNOWN {
  return Gender.UNKNOWN;
}

export function getGenderVariations(): ReadonlyArray<
  (typeof Gender)[keyof typeof Gender]
> {
  return [Gender.UNKNOWN, Gender.MALE, Gender.FEMALE];
}
