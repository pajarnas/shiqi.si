import { useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useUiStrings } from '../strings';

/** Copy text and confirm with a toast. */
export function useClipboard(): (text: string, label?: string) => Promise<void> {
  const toast = useToast();
  const s = useUiStrings();
  return useCallback(
    async (text: string, label = s.copied) => {
      try {
        await navigator.clipboard.writeText(text);
        toast(label);
      } catch {
        toast(s.copyFailed);
      }
    },
    [toast, s],
  );
}
