import type { ReactNode } from 'react';
import type { FindingDefinition, FindingResult } from '../../api/types';
import { ErrorPanel } from '../ErrorPanel';
import { PLANE_LABEL } from '../viewer/PlaneTabs';
import { FindingRow } from './FindingRow';
import type { LabelRevealState } from './LabelReveal';
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
  onToggleLabel,
  onRetryLabel,
  labelNotice,
  selectedId = null,
  onSelect,
  children,
}: {
  definitions: FindingDefinition[];
  analysis: Analysis;
  announcement: Announcement;
  onRun: () => void;
  revealFor: (findingId: string) => LabelRevealState | undefined;
  onToggleLabel: (findingId: string) => void;
  onRetryLabel: () => void;
  /** Evaluation-only notice from the labels endpoint, shown while a label is visible. */
  labelNotice: string | null;
  /** Finding shown in the explanation panel; `[` and `]` move it (DESIGN.md section 12). */
  selectedId?: string | null;
  onSelect?: (findingId: string) => void;
  /** Rendered under the list (the explanation panel). */
  children?: ReactNode;
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
            onToggleLabel={() => onToggleLabel(f.finding_id)}
            onRetryLabel={onRetryLabel}
            onRetry={onRun}
            selected={f.finding_id === selectedId}
            onSelect={onSelect ? () => onSelect(f.finding_id) : undefined}
          />
        ))}
      </ul>
      {labelNotice ? <p className="label-notice faint">{labelNotice}</p> : null}
      {children}
    </aside>
  );
}
