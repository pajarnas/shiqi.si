import { useCallback } from 'react';
import { useToast } from '../components/Toast';

/** Copy text and confirm with a toast. */
export function useClipboard(): (text: string, label?: string) => Promise<void> {
  const toast = useToast();
  return useCallback(
    async (text: string, label = '已复制') => {
      try {
        await navigator.clipboard.writeText(text);
        toast(label);
      } catch {
        toast('复制失败，请手动选择');
      }
    },
    [toast],
  );
}
