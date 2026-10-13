import { createContext, useContext, type ReactNode } from 'react';
import { RABBIT_STRINGS, type RabbitStrings } from './strings';

const RabbitStringsContext = createContext<RabbitStrings>(RABBIT_STRINGS);

export function RabbitStringsProvider({
  strings,
  children,
}: {
  strings: RabbitStrings;
  children: ReactNode;
}) {
  return <RabbitStringsContext.Provider value={strings}>{children}</RabbitStringsContext.Provider>;
}

export const useRabbitStrings = () => useContext(RabbitStringsContext);
