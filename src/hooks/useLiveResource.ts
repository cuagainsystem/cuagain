import { useCallback, useEffect, useRef, useState } from 'react';
import type { Result } from '../services/result';
import { subscribeToTable } from '../services/realtime';

export type LiveTable = { table: string; filter?: string };

/*
  Like useResource, but it keeps itself up to date: it reloads quietly when the database
  announces a change (Realtime) and also on a timer, because Realtime can be unavailable.
  `result` is null only while the very first answer for this `load` is on its way.
  A failed refresh never replaces data that was already on screen.
*/
export function useLiveResource<T>(load: () => Promise<Result<T>>, tables: readonly LiveTable[] = [], intervalMs = 10000) {
  const [state, setState] = useState<{ load: typeof load; result: Result<T> } | null>(null);
  const runRef = useRef<() => void>(() => undefined);
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    let active = true;
    const watched = JSON.parse(tablesKey) as LiveTable[];

    const run = () => {
      void load().then((result) => {
        if (!active) return;
        setState((previous) =>
          !result.ok && previous && previous.load === load && previous.result.ok ? previous : { load, result },
        );
      });
    };
    runRef.current = run;
    run();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, intervalMs);
    const stops = watched.map((item, index) => subscribeToTable(`live-${item.table}-${index}-${Math.random().toString(36).slice(2, 8)}`, item.table, run, item.filter));

    return () => {
      active = false;
      window.clearInterval(timer);
      stops.forEach((stop) => stop());
    };
  }, [load, tablesKey, intervalMs]);

  const reload = useCallback(() => runRef.current(), []);
  const result = state && state.load === load ? state.result : null;
  return { result, loading: result === null, reload };
}
