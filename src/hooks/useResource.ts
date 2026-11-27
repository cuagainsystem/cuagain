import { useCallback, useEffect, useState } from 'react';
import type { Result } from '../services/result';

/*
  Loads data for a screen. `load` must be memoised (useCallback) so it only changes when its
  inputs change. While the answer is for an older `load`, `result` is null, which the screen
  treats as "loading". That avoids ever showing stale data for the wrong inputs.
*/
export function useResource<T>(load: () => Promise<Result<T>>) {
  const [state, setState] = useState<{ load: typeof load; reloads: number; result: Result<T> } | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;

    load().then((result) => {
      if (active) setState({ load, reloads, result });
    });

    return () => {
      active = false;
    };
  }, [load, reloads]);

  const result = state && state.load === load && state.reloads === reloads ? state.result : null;
  const reload = useCallback(() => setReloads((count) => count + 1), []);

  return { result, loading: result === null, reload };
}
