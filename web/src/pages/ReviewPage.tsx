import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { FindingDefinition, Plane, StudyDetail } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import { checkOverlay, type ViewerPosition } from '../components/explanations/alignment';
import { ExplanationPanel } from '../components/explanations/ExplanationPanel';
import { useExplanation } from '../components/explanations/useExplanation';
import { FindingsPanel } from '../components/findings/FindingsPanel';
import { useAnalysis } from '../components/findings/useAnalysis';
import { useLabelReveal } from '../components/findings/useLabelReveal';
import { ViewerPanel, type JumpRequest } from '../components/viewer/ViewerPanel';
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
  const result = analysis.phase === 'done' ? analysis.result : null;
  const findingIds = result
    ? result.findings.map((f) => f.finding_id)
    : definitions.map((d) => d.finding_id);
  const [selectedId, setSelectedId] = useState<string | null>(findingIds[0] ?? null);
  const selected = findingIds.includes(selectedId ?? '') ? selectedId : (findingIds[0] ?? null);
  const finding = result?.findings.find((f) => f.finding_id === selected) ?? null;
  const explanation = useExplanation(study.study_id, result?.prediction_id ?? null, finding);

  const [position, setPosition] = useState<ViewerPosition | null>(null);
  const onPosition = useCallback((p: ViewerPosition | null) => setPosition(p), []);
  const [jump, setJump] = useState<JumpRequest | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [opacity, setOpacity] = useState(0.6);

  const moveSelection = (delta: number) => {
    const i = findingIds.indexOf(selected ?? '');
    const next = findingIds[Math.min(Math.max(i + delta, 0), findingIds.length - 1)];
    if (next) setSelectedId(next);
  };
  useKeyboardShortcuts({
    r: () => {
      if (analysis.phase !== 'running') run();
    },
    '[': () => moveSelection(-1),
    ']': () => moveSelection(1),
  });

  const shownExplanation = explanation.phase === 'ready' ? explanation.explanation : null;
  const overlayCheck =
    result && shownExplanation && (shownExplanation.attention?.length ?? 0) > 0
      ? checkOverlay(shownExplanation, position, {
          predictionId: result.prediction_id,
          modelVersion: result.model.model_version,
        })
      : null;
  const overlay = overlayOn && overlayCheck?.ok ? { map: overlayCheck.map, opacity } : null;
  const onJump = (seriesId: string, plane: Plane, sliceIndex: number) =>
    setJump((j) => ({ seriesId, plane, sliceIndex, nonce: (j?.nonce ?? 0) + 1 }));

  const source = result ? result.provenance.source : null;
  const selectedName =
    result?.findings.find((f) => f.finding_id === selected)?.display_name ??
    definitions.find((d) => d.finding_id === selected)?.display_name ??
    null;
  return (
    <div className="workspace">
      <ViewerPanel
        study={study}
        fixtureStripe={study.origin === 'fixture' || source === 'fixture'}
        jump={jump}
        overlay={overlay}
        onPosition={onPosition}
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
        selectedId={selected}
        onSelect={setSelectedId}
      >
        <ExplanationPanel
          findingName={selectedName}
          state={explanation}
          overlay={overlayCheck}
          overlayOn={overlayOn}
          opacity={opacity}
          onToggleOverlay={setOverlayOn}
          onOpacity={setOpacity}
          onJump={onJump}
        />
      </FindingsPanel>
    </div>
  );
}
