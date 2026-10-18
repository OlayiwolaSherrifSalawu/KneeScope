import { useEffect, useState } from 'react';
import { ApiRequestError, api } from '../../api/client';
import type { Explanation, FindingResult } from '../../api/types';

export type ExplanationState =
  | { phase: 'none'; reason: string }
  | { phase: 'loading' }
  | { phase: 'ready'; explanation: Explanation }
  | { phase: 'error'; error: ApiRequestError };

type Settled = { key: string; explanation?: Explanation; error?: ApiRequestError };

/**
 * Loads the explanation for one finding of one prediction. Nothing is requested unless the
 * finding has a score and the API says an explanation exists; the state is keyed by
 * prediction and finding, so an older explanation never attaches to a newer result.
 */
export function useExplanation(
  studyId: string,
  predictionId: string | null,
  finding: FindingResult | null,
): ExplanationState & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const wanted =
    predictionId && finding && finding.status === 'scored' && finding.explanation_available;
  const key = wanted ? `${predictionId}|${finding.finding_id}|${attempt}` : null;

  useEffect(() => {
    if (!key || !predictionId || !finding) return;
    const controller = new AbortController();
    api
      .explanation(studyId, finding.finding_id, predictionId, { signal: controller.signal })
      .then((explanation) => setSettled({ key, explanation }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          e instanceof ApiRequestError
            ? e
            : new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'Unexpected client error.' });
        setSettled({ key, error });
      });
    return () => controller.abort();
  }, [key, studyId, predictionId, finding]);

  const reload = () => setAttempt((n) => n + 1);
  if (!predictionId) return { phase: 'none', reason: 'Run analysis to see explanations.', reload };
  if (!finding) return { phase: 'none', reason: 'Select a finding.', reload };
  if (finding.status !== 'scored')
    return { phase: 'none', reason: 'No score, so no explanation.', reload };
  if (!finding.explanation_available)
    return { phase: 'none', reason: 'No explanation was produced for this finding.', reload };
  if (settled?.key !== key) return { phase: 'loading', reload };
  if (settled.error) return { phase: 'error', error: settled.error, reload };
  return { phase: 'ready', explanation: settled.explanation as Explanation, reload };
}
