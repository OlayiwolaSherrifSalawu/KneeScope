import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api } from '../../api/client';
import type { PredictionResponse } from '../../api/types';

export type Analysis =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number }
  | { phase: 'done'; result: PredictionResponse }
  | { phase: 'error'; error: ApiRequestError };

/** One entry per announcement; `n` makes a repeated sentence a new live-region update. */
export type Announcement = { n: number; text: string };

const SOURCE_SENTENCE = {
  fixture: 'Fixture result, not a model output.',
  cached: 'Cached result.',
  live: 'Live result.',
} as const;

function toApiError(e: unknown): ApiRequestError {
  if (e instanceof ApiRequestError) return e;
  return new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'Unexpected client error.' });
}

/**
 * Runs `POST /predictions` for one study. The request carries only the study ID: dataset
 * labels never feed inference. At most one request is in flight; it is aborted on unmount.
 */
export function useAnalysis(studyId: string) {
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [announcement, setAnnouncement] = useState<Announcement>({ n: 0, text: '' });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const run = useCallback(() => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setAnalysis({ phase: 'running', startedAt: Date.now() });
    setAnnouncement((a) => ({ n: a.n + 1, text: 'Analysis started.' }));
    api
      .predict({ study_id: studyId }, { signal: controller.signal })
      .then((result) => {
        setAnalysis({ phase: 'done', result });
        setAnnouncement((a) => ({
          n: a.n + 1,
          text: `Analysis complete. ${SOURCE_SENTENCE[result.provenance.source]}`,
        }));
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const error = toApiError(e);
        setAnalysis({ phase: 'error', error });
        setAnnouncement((a) => ({ n: a.n + 1, text: `Analysis failed. ${error.code}.` }));
      })
      .finally(() => {
        if (inFlight.current === controller) inFlight.current = null;
      });
  }, [studyId]);

  return { analysis, announcement, run };
}

/** Whole seconds since `startedAt` (null when not running), refreshed while running. */
export function useElapsedSeconds(startedAt: number | null): number {
  const [tick, setTick] = useState<{ startedAt: number; seconds: number } | null>(null);
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(
      () => setTick({ startedAt, seconds: Math.floor((Date.now() - startedAt) / 1000) }),
      250,
    );
    return () => clearInterval(id);
  }, [startedAt]);
  return tick !== null && tick.startedAt === startedAt ? tick.seconds : 0;
}
