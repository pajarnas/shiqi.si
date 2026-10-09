// Locale data from the root loader, for components and meta functions.
// Kept out of root.tsx so routes can import it without pulling in server code.
import { useRouteLoaderData } from 'react-router';
import type { RootData } from '~/root';
import { stringsFor } from './index';

export const useRootData = () => useRouteLoaderData<RootData>('root');

/** The dictionary for meta functions, which run outside React. Pass their `matches`. */
export function metaStrings(matches: readonly unknown[]) {
  const root = matches.find(
    (m): m is { id: string; loaderData?: RootData } =>
      typeof m === 'object' && m !== null && (m as { id?: string }).id === 'root',
  );
  return stringsFor(root?.loaderData?.locale ?? 'en', root?.loaderData?.extra);
}
