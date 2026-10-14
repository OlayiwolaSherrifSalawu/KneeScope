import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api } from '../../api/client';
import type { StudyLabels } from '../../api/types';
import type { LabelRevealState } from './LabelReveal';

type Fetch =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; data: StudyLabels }
  | { phase: 'error'; error: ApiRequestError };

function toApiError(e: unknown): ApiRequestError {
  if (e instanceof ApiRequestError) return e;
  return new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'Unexpected client error.' });
}

/**
 * Dataset labels for the review page. Nothing is requested until the first reveal; the
 * response is kept apart from the analysis state and is never sent anywhere. The hook is
 * mounted per study, so a study change hides every label again.
 */
export function useLabelReveal(studyId: string) {
  const [fetched, setFetched] = useState<Fetch>({ phase: 'idle' });
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const load = useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setFetched({ phase: 'loading' });
    api.labels(studyId, { signal: c.signal }).then(
      (data) => {
        if (!c.signal.aborted) setFetched({ phase: 'ready', data });
      },
      (e: unknown) => {
        if (!c.signal.aborted) setFetched({ phase: 'error', error: toApiError(e) });
      },
    );
  }, [studyId]);

  const toggle = (findingId: string) => {
    if (revealed.has(findingId)) {
      setRevealed((prev) => {
        const next = new Set(prev);
        next.delete(findingId);
        return next;
      });
      return;
    }
    setRevealed((prev) => new Set(prev).add(findingId));
    if (fetched.phase === 'idle' || fetched.phase === 'error') load();
  };

  const revealFor = (findingId: string): LabelRevealState | undefined => {
    if (!revealed.has(findingId)) return undefined;
    if (fetched.phase === 'ready') {
      return {
        phase: 'ready',
        label: fetched.data.labels.find((l) => l.finding_id === findingId) ?? null,
      };
    }
    if (fetched.phase === 'error') return { phase: 'error', error: fetched.error };
    return { phase: 'loading' };
  };

  return {
    revealFor,
    toggle,
    retry: load,
    /** Shown once any label is visible. */
    notice: fetched.phase === 'ready' && revealed.size > 0 ? fetched.data.notice : null,
  };
}
