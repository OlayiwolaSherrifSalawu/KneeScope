import type { ReactNode } from 'react';
import { Sparkles, Play, ShieldAlert } from 'lucide-react';
import type { FindingDefinition, FindingResult } from '../../api/types';
import { ErrorPanel } from '../ErrorPanel';
import { PLANE_LABEL } from '../viewer/PlaneTabs';
import { FindingRow } from './FindingRow';
import type { LabelRevealState } from './LabelReveal';
import { ProvenanceStrip } from './ProvenanceStrip';
import { RunAnalysisButton, RunStatus } from './RunAnalysis';
import type { Analysis, Announcement, RunAnalysisOptions } from './useAnalysis';
import { ModelPipelineStatus } from '../pipeline/ModelPipelineStatus';

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
  onSwitchCleanStudy,
  studyId,
  children,
}: {
  definitions: FindingDefinition[];
  analysis: Analysis;
  announcement: Announcement;
  onRun: (options?: RunAnalysisOptions) => void;
  revealFor: (findingId: string) => LabelRevealState | undefined;
  onToggleLabel: (findingId: string) => void;
  onRetryLabel: () => void;
  /** Evaluation-only notice from the labels endpoint, shown while a label is visible. */
  labelNotice: string | null;
  /** Finding shown in the explanation panel; `[` and `]` move it (DESIGN.md section 12). */
  selectedId?: string | null;
  onSelect?: (findingId: string) => void;
  onSwitchCleanStudy?: () => void;
  studyId?: string;
  /** Rendered under the list (the explanation panel). */
  children?: ReactNode;
}) {
  const result = analysis.phase === 'done' ? analysis.result : null;
  const source = result?.provenance.source ?? null;
  const rows: FindingResult[] = result ? result.findings : definitions.map(notEvaluated);
  const isSimulated = (source as string) === 'simulated' || (result?.provenance.notice?.includes('simulated') ?? false);

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

      {/* Visual Pipeline Flow */}
      {studyId ? (
        <ModelPipelineStatus
          studyId={studyId}
          analysis={analysis}
          isSimulatedRecovery={isSimulated}
        />
      ) : null}

      {analysis.phase === 'error' ? (
        <div className="rounded border border-amber-600/70 bg-[var(--ks-lb-panel)] p-3 mb-3 text-xs space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="font-semibold text-white text-xs tracking-wide">
                {analysis.error.code === 'PREPROCESSING_FAILED'
                  ? 'Preprocessing Input Issue Detected'
                  : 'Analysis Notice'}
              </h3>
            </div>
            <span className="mono text-[10px] text-amber-400/90 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
              {analysis.error.code}
            </span>
          </div>

          <p className="text-[var(--ks-lb-text-muted)] text-[11px] leading-relaxed">
            {analysis.error.code === 'PREPROCESSING_FAILED'
              ? 'This study simulates a corrupted series input. You can run automated simulated inference or switch to the healthy study.'
              : analysis.error.message}
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onRun({ forceSimulation: true })}
              className="btn primary text-xs flex-1 justify-center gap-1.5 py-1.5 font-medium shadow-sm"
              title="Run simulation engine with ResNet-18 weights (bypasses corrupted input)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run with Simulated Fix
            </button>
            {onSwitchCleanStudy ? (
              <button
                type="button"
                onClick={onSwitchCleanStudy}
                className="btn text-xs flex-1 justify-center py-1.5 text-[var(--ks-lb-accent)] border-[var(--ks-lb-line)] hover:bg-[var(--ks-lb-raised)]"
              >
                Switch to Study 001
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {result ? <ProvenanceStrip result={result} /> : null}
      {result?.missing_planes.length ? (
        <div className="run-status">
          Missing planes: {result.missing_planes.map((p) => PLANE_LABEL[p]).join(', ')}
        </div>
      ) : null}
      {rows.some((f) => f.status === 'failed') && analysis.phase === 'done' ? (
        <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/60 text-xs mb-2 text-amber-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-amber-300">
              Resilience Test: Finding Failure Simulated
            </span>
            <button
              type="button"
              onClick={() => onRun({ forceSimulation: true })}
              className="btn primary text-[10px] py-1 px-2 h-6"
              title="Re-run using active model encoder to score all findings"
            >
              Score All with Model
            </button>
          </div>
          <p className="text-[10px] text-amber-200/80 leading-tight">
            This study fixture includes an intentional inference failure to test UI error isolation. Click "Score All with Model" to bypass and compute full scores.
          </p>
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
