export default function nullthrows<T>(
  x: T | null | undefined,
  message?: string
): T {
  if (x != null) {
    return x;
  }
  const error = new Error(
    message !== undefined ? message : 'Got unexpected ' + x
  );
  // @ts-expect-error
  error.framesToPop = 1;
  throw error;
}
