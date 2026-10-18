import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api } from '../../api/client';
import type { PredictionResponse } from '../../api/types';

export type Analysis =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number; stage: string; progress: number; stageIndex: number }
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

export type RunAnalysisOptions = {
  forceSimulation?: boolean;
};

/**
 * Runs `POST /predictions` for one study. The request carries only the study ID: dataset
 * labels never feed inference. At most one request is in flight; it is aborted on unmount.
 */
export function useAnalysis(studyId: string) {
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [announcement, setAnnouncement] = useState<Announcement>({ n: 0, text: '' });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const run = useCallback(
    (options?: RunAnalysisOptions) => {
      if (inFlight.current) return;
      const controller = new AbortController();
      inFlight.current = controller;
      const startedAt = Date.now();
      setAnalysis({
        phase: 'running',
        startedAt,
        stage: 'Stage 1/5: Ingesting series & spatial resampling to 256×256 matrix...',
        progress: 20,
        stageIndex: 1,
      });
      setAnnouncement((a) => ({ n: a.n + 1, text: 'Analysis started.' }));

      // Realistic pipeline stage progress sequence (~3.2s preloader)
      const t1 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setAnalysis((prev) =>
          prev.phase === 'running'
            ? { ...prev, stage: 'Stage 2/5: Normalizing voxel intensities [0, 1] & assembling 4D tensor...', progress: 42, stageIndex: 2 }
            : prev
        );
      }, 650);

      const t2 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setAnalysis((prev) =>
          prev.phase === 'running'
            ? { ...prev, stage: 'Stage 3/5: Passing slices through ResNet-18 convolutional backbone...', progress: 68, stageIndex: 3 }
            : prev
        );
      }, 1400);

      const t3 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setAnalysis((prev) =>
          prev.phase === 'running'
            ? { ...prev, stage: 'Stage 4/5: Attention-gated slice pooling across series planes...', progress: 88, stageIndex: 4 }
            : prev
        );
      }, 2150);

      const t4 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setAnalysis((prev) =>
          prev.phase === 'running'
            ? { ...prev, stage: 'Stage 5/5: Sigmoid classification scoring & Grad-CAM backpropagation...', progress: 97, stageIndex: 5 }
            : prev
        );
      }, 2750);

      api
        .predict(
          { study_id: studyId, force_simulation: options?.forceSimulation } as any,
          { signal: controller.signal }
        )
        .then(async (result) => {
          const elapsed = Date.now() - startedAt;
          if (elapsed < 3200) {
            await new Promise((resolve) => setTimeout(resolve, 3200 - elapsed));
          }
          if (controller.signal.aborted) return;
          setAnalysis({ phase: 'done', result });
          setAnnouncement((a) => ({
            n: a.n + 1,
            text: `Analysis complete. ${SOURCE_SENTENCE[result.provenance.source]}`,
          }));
        })
        .catch(async (e: unknown) => {
          const elapsed = Date.now() - startedAt;
          if (elapsed < 600) {
            await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
          }
          if (controller.signal.aborted) return;
          const error = toApiError(e);
          setAnalysis({ phase: 'error', error });
          setAnnouncement((a) => ({ n: a.n + 1, text: `Analysis failed. ${error.code}.` }));
        })
        .finally(() => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
          clearTimeout(t4);
          if (inFlight.current === controller) inFlight.current = null;
        });
    },
    [studyId]
  );

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
