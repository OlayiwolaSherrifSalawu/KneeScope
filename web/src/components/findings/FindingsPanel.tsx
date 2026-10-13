import type { FindingDefinition, FindingResult } from '../../api/types';
import { ErrorPanel } from '../ErrorPanel';
import { PLANE_LABEL } from '../viewer/PlaneTabs';
import { FindingRow, type LabelReveal } from './FindingRow';
import { ProvenanceStrip } from './ProvenanceStrip';
import { RunAnalysisButton, RunStatus } from './RunAnalysis';
import type { Analysis, Announcement } from './useAnalysis';

function notEvaluated(d: FindingDefinition): FindingResult {
  return {
    finding_id: d.finding_id,
    display_name: d.display_name,
    status: 'not_evaluated',
    explanation_available: false,
  };
}

/**
 * The findings column (DESIGN.md sections 9.6 to 9.8, 11, 16). Rows come from the active
 * finding profile until a result exists, then from the result. A study-level failure shows
 * the error with its code and request ID and no scores.
 */
export function FindingsPanel({
  definitions,
  analysis,
  announcement,
  onRun,
  revealFor,
  onRevealLabel,
}: {
  definitions: FindingDefinition[];
  analysis: Analysis;
  announcement: Announcement;
  onRun: () => void;
  revealFor: (findingId: string) => LabelReveal | undefined;
  onRevealLabel: (findingId: string) => void;
}) {
  const result = analysis.phase === 'done' ? analysis.result : null;
  const source = result?.provenance.source ?? null;
  const rows: FindingResult[] = result ? result.findings : definitions.map(notEvaluated);
  return (
    <aside className="findings" aria-label="Findings">
      <div className="col-head">
        <div>
          <h2>Findings</h2>
          <p>Model scores for the active finding profile</p>
        </div>
        <RunAnalysisButton analysis={analysis} onRun={onRun} />
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        <span key={announcement.n}>{announcement.text}</span>
      </div>
      <RunStatus analysis={analysis} />
      {analysis.phase === 'error' ? (
        <ErrorPanel error={analysis.error} title="Analysis failed" onRetry={onRun} />
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
            reveal={revealFor(f.finding_id)}
            onRevealLabel={() => onRevealLabel(f.finding_id)}
            onRetry={onRun}
          />
        ))}
      </ul>
    </aside>
  );
}
