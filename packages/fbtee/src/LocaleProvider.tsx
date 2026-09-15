import { createContext, ReactNode, use, useSyncExternalStore } from 'react';
import { FbteeRuntime, getRuntimeStore } from './createFbteeRuntime.tsx';

const Context = createContext<FbteeRuntime | null>(null);

export default function LocaleProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: FbteeRuntime;
}) {
  return <Context value={runtime}>{children}</Context>;
}

export function useFbt(): FbteeRuntime {
  const runtime = use(Context);
  if (!runtime) {
    throw new Error('useFbt must be used within a LocaleProvider.');
  }
  const { getSnapshot, subscribe } = getRuntimeStore(runtime);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return runtime;
}
