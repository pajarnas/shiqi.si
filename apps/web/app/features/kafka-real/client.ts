// The browser side of /api/kafka/*: poll the snapshot, read records, and the
// admin writes (the /admin password goes in an Authorization header and is
// kept only in memory).
import { useEffect, useRef, useState } from 'react';
import type { KafkaRecordView, KafkaSnapshot } from './snapshot';
import { produceRates } from './view';

export const POLL_MS = 2000;

export type ClusterState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; status: number }
  | { kind: 'ok'; snapshot: KafkaSnapshot; rates: Map<string, number> };

/** Poll the snapshot while the tab is visible; keeps the last good one through a failed poll. */
export function useRealCluster(): ClusterState {
  const [state, setState] = useState<ClusterState>({ kind: 'loading' });
  const last = useRef<KafkaSnapshot | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/kafka/snapshot');
          if (stopped) return;
          if (res.status === 503) setState({ kind: 'unavailable' });
          else if (!res.ok) {
            if (!last.current) setState({ kind: 'error', status: res.status });
          } else {
            const snapshot = (await res.json()) as KafkaSnapshot;
            if (stopped) return;
            const rates = produceRates(last.current, snapshot);
            last.current = snapshot;
            setState({ kind: 'ok', snapshot, rates });
          }
        } catch {
          if (!stopped && !last.current) setState({ kind: 'error', status: 0 });
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

/** The latest records of one partition, refetched whenever `version` (its high watermark) moves. */
export function useRecords(topic: string | null, partition: number, version: number) {
  const [records, setRecords] = useState<KafkaRecordView[] | null>(null);
  useEffect(() => {
    if (!topic) return;
    let stopped = false;
    const q = new URLSearchParams({ topic, partition: String(partition), limit: '20' });
    fetch(`/api/kafka/records?${q}`)
      .then((r) => (r.ok ? (r.json() as Promise<KafkaRecordView[]>) : null))
      .then((list) => {
        if (!stopped) setRecords(list);
      })
      .catch(() => {
        if (!stopped) setRecords(null);
      });
    return () => {
      stopped = true;
    };
  }, [topic, partition, version]);
  return topic ? records : null;
}

/** Base64 of UTF-8, which is what HTTP Basic expects. */
const basic = (text: string) =>
  btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(''));

export type AdminResult = { ok: true } | { ok: false; status: number; error: string };

async function adminCall(
  password: string,
  path: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<AdminResult> {
  try {
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Basic ${basic(`admin:${password}`)}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: res.status, error: data?.error ?? '' };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

export const createTopic = (password: string, name: string, partitions: number) =>
  adminCall(password, '/api/kafka/topics', 'POST', { name, partitions, replicationFactor: 3 });

export const deleteTopic = (password: string, name: string) =>
  adminCall(password, `/api/kafka/topics/${encodeURIComponent(name)}`, 'DELETE');

export const produceRecord = (password: string, topic: string, key: string, value: string) =>
  adminCall(password, '/api/kafka/produce', 'POST', { topic, key: key || null, value });
