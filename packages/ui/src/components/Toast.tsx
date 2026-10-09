import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Notify = (message: string) => void;

const ToastContext = createContext<Notify>(() => {});

/** Hosts one short-lived message at a time, announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const notify = useCallback((text: string) => setMsg({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 1600);
    return () => clearTimeout(id);
  }, [msg]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div role="status" aria-live="polite">
        {msg && (
          <div key={msg.key} className="ui-toast">
            {msg.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
