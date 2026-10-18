import { useEffect, useEffectEvent, useState } from 'react';
import { ApiRequestError } from '../api/client';

export type AsyncState<T> =
  | { phase: 'loading'; data: T | undefined }
  | { phase: 'ready'; data: T }
  | { phase: 'error'; error: ApiRequestError; data: T | undefined };

type Settled<T> = { token: string; data?: T; error?: ApiRequestError };

function toError(e: unknown): ApiRequestError {
  if (e instanceof ApiRequestError) return e;
  return new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'Unexpected client error.' });
}

/**
 * Loads data when `key` changes. Loading is derived (the settled result belongs to an older
 * key), so previously loaded data stays available while a reload is in flight.
 */
export function useAsync<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): AsyncState<T> & { reload: () => void } {
  const [reloads, setReloads] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const token = `${key}#${reloads}`;
  const run = useEffectEvent(load);

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ token, data });
      },
      (e: unknown) => {
        if (!controller.signal.aborted) setSettled({ token, error: toError(e) });
      },
    );
    return () => controller.abort();
  }, [token]);

  const reload = () => setReloads((n) => n + 1);
  const last = settled?.data;
  if (settled === null || settled.token !== token) {
    return { phase: 'loading', data: last, reload };
  }
  if (settled.error) return { phase: 'error', error: settled.error, data: last, reload };
  return { phase: 'ready', data: settled.data as T, reload };
}
