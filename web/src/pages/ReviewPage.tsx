import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiRequestError, api } from '../api/client';
import {
  type FindingDefinition,
  type FindingResult,
  type PredictionResponse,
  type StudyDetail,
  type StudyLabels,
} from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import { FindingRow, type LabelReveal } from '../components/findings/FindingRow';
import { ProvenanceStrip } from '../components/findings/ProvenanceStrip';
import { PLANE_LABEL } from '../components/viewer/PlaneTabs';
import { ViewerPanel } from '../components/viewer/ViewerPanel';
import { useAsync } from '../hooks/useAsync';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

type Analysis =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: PredictionResponse }
  | { phase: 'error'; error: ApiRequestError };

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

function notEvaluated(d: FindingDefinition): FindingResult {
  return {
    finding_id: d.finding_id,
    display_name: d.display_name,
    status: 'not_evaluated',
    explanation_available: false,
  };
}

function Workspace({
  study,
  definitions,
}: {
  study: StudyDetail;
  definitions: FindingDefinition[];
}) {
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [labels, setLabels] = useState<Labels>({ phase: 'idle' });
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  const runningRef = useRef(false);

  const run = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setAnalysis({ phase: 'running' });
    setAnnouncement('Analysis started.');
    api
      .predict({ study_id: study.study_id })
      .then((result) => {
        setAnalysis({ phase: 'done', result });
        setAnnouncement('Analysis complete.');
      })
      .catch((e: unknown) => {
        const error =
          e instanceof ApiRequestError
            ? e
            : new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'Unexpected client error.' });
        setAnalysis({ phase: 'error', error });
        setAnnouncement(`Analysis failed. ${error.code}.`);
      })
      .finally(() => {
        runningRef.current = false;
      });
  };

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

  const result = analysis.phase === 'done' ? analysis.result : null;
  const source = result?.provenance.source ?? null;
  const rows: FindingResult[] = result ? result.findings : definitions.map(notEvaluated);
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

      <aside className="findings" aria-label="Findings">
        <div className="col-head">
          <div>
            <h2>Findings</h2>
            <p>Model scores for the active finding profile</p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={run}
            disabled={analysis.phase === 'running'}
          >
            {analysis.phase === 'running' ? 'Analysing…' : 'Run analysis'}
          </button>
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>
        {analysis.phase === 'running' ? (
          <div className="run-status">Analysing… waiting for the API.</div>
        ) : null}
        {analysis.phase === 'error' ? (
          <ErrorPanel error={analysis.error} title="Analysis failed" onRetry={run} />
        ) : null}
        {result ? <ProvenanceStrip result={result} /> : null}
        {result?.missing_planes.length ? (
          <div className="run-status">
            Missing planes: {result.missing_planes.map((p) => PLANE_LABEL[p]).join(', ')}
          </div>
        ) : null}
        <ul className="finding-list" aria-busy={analysis.phase === 'running'}>
          {rows.map((f) => (
            <FindingRow
              key={f.finding_id}
              finding={f}
              source={source}
              reveal={labelFor(f.finding_id)}
              onRevealLabel={() => reveal(f.finding_id)}
              onRetry={run}
            />
          ))}
        </ul>
      </aside>
    </div>
  );
}
