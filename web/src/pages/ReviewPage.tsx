import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { FindingDefinition, StudyDetail } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import { FindingsPanel } from '../components/findings/FindingsPanel';
import { useAnalysis } from '../components/findings/useAnalysis';
import { useLabelReveal } from '../components/findings/useLabelReveal';
import { ViewerPanel } from '../components/viewer/ViewerPanel';
import { useAsync } from '../hooks/useAsync';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

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
  const labels = useLabelReveal(study.study_id);

  useKeyboardShortcuts({
    r: () => {
      if (analysis.phase !== 'running') run();
    },
  });

  const source = analysis.phase === 'done' ? analysis.result.provenance.source : null;
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
        revealFor={labels.revealFor}
        onToggleLabel={labels.toggle}
        onRetryLabel={labels.retry}
        labelNotice={labels.notice}
      />
    </div>
  );
}
