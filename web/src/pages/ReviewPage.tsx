import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiRequestError, api } from '../api/client';
import { type FindingDefinition, type StudyDetail, type StudyLabels } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import type { LabelReveal } from '../components/findings/FindingRow';
import { FindingsPanel } from '../components/findings/FindingsPanel';
import { useAnalysis } from '../components/findings/useAnalysis';
import { ViewerPanel } from '../components/viewer/ViewerPanel';
import { useAsync } from '../hooks/useAsync';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

type Labels =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; data: StudyLabels }
  | { phase: 'error'; error: ApiRequestError };

export function ReviewPage() {
  const { studyId = '' } = useParams();
  const study = useAsync<StudyDetail>(`study:${studyId}`, (signal) =>
    api.study(studyId, { signal }),
  );
  const profile = useAsync('findings', (signal) => api.findings({ signal }));

  return (
    <>
      {study.phase === 'ready' && profile.phase === 'ready' ? (
        // Keyed by study: selection, analysis and revealed labels reset on study change.
        <Workspace
          key={study.data.study_id}
          study={study.data}
          definitions={profile.data.findings}
        />
      ) : (
        <div
          className="browser"
          aria-busy={study.phase === 'loading' || profile.phase === 'loading'}
        >
          {study.phase === 'error' ? (
            <ErrorPanel
              error={study.error}
              title="Study could not be loaded"
              onRetry={study.reload}
            />
          ) : profile.phase === 'error' ? (
            <ErrorPanel
              error={profile.error}
              title="Findings list could not be loaded"
              onRetry={profile.reload}
            />
          ) : (
            <p className="muted">Loading study…</p>
          )}
        </div>
      )}
    </>
  );
}

function Workspace({
  study,
  definitions,
}: {
  study: StudyDetail;
  definitions: FindingDefinition[];
}) {
  const { analysis, announcement, run } = useAnalysis(study.study_id);
  const [labels, setLabels] = useState<Labels>({ phase: 'idle' });
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const reveal = (findingId: string) => {
    setRevealed((prev) => new Set(prev).add(findingId));
    if (labels.phase === 'idle' || labels.phase === 'error') {
      setLabels({ phase: 'loading' });
      api
        .labels(study.study_id)
        .then((data) => setLabels({ phase: 'ready', data }))
        .catch((e: unknown) =>
          setLabels({
            phase: 'error',
            error:
              e instanceof ApiRequestError
                ? e
                : new ApiRequestError({
                    code: 'INTERNAL_ERROR',
                    message: 'Unexpected client error.',
                  }),
          }),
        );
    }
  };

  useKeyboardShortcuts({
    r: () => {
      if (analysis.phase !== 'running') run();
    },
  });

  const source = analysis.phase === 'done' ? analysis.result.provenance.source : null;
  const labelFor = (id: string): LabelReveal | undefined => {
    if (!revealed.has(id)) return undefined;
    if (labels.phase === 'ready') {
      return { phase: 'ready', label: labels.data.labels.find((l) => l.finding_id === id) ?? null };
    }
    if (labels.phase === 'error') {
      return { phase: 'error', code: labels.error.code, message: labels.error.message };
    }
    return { phase: 'loading' };
  };

  return (
    <div className="workspace">
      <ViewerPanel
        study={study}
        fixtureStripe={study.origin === 'fixture' || source === 'fixture'}
      />

      <FindingsPanel
        definitions={definitions}
        analysis={analysis}
        announcement={announcement}
        onRun={run}
        revealFor={labelFor}
        onRevealLabel={reveal}
      />
    </div>
  );
}
