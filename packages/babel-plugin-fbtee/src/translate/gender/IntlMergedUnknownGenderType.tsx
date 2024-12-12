import { Gender } from '../IntlVariations.tsx';

export function getFallback(): typeof Gender.MALE {
  return Gender.MALE;
}

export function getGenderVariations(): ReadonlyArray<Gender> {
  return [Gender.MALE, Gender.FEMALE];
}
