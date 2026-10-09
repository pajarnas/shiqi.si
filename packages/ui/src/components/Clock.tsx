import { useState } from 'react';
import { useInterval } from '../hooks/useInterval';
import { useMounted } from '../hooks/useMounted';

const fmt = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Local HH:MM, rendered only after hydration so server and client agree. */
export function Clock({ className }: { className?: string }) {
  const mounted = useMounted();
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 10_000);
  if (!mounted) return <span className={className}>--:--</span>;
  return (
    <time className={className} dateTime={now.toISOString()}>
      {fmt(now)}
    </time>
  );
}
