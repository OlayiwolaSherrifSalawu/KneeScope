import type { Analysis } from './useAnalysis';
import { useElapsedSeconds } from './useAnalysis';

/**
 * Primary button for the findings column header (DESIGN.md section 9.6): "Run analysis",
 * "Analysing…" while the request is in flight (disabled), "Run again" afterwards.
 */
export function RunAnalysisButton({ analysis, onRun }: { analysis: Analysis; onRun: () => void }) {
  const running = analysis.phase === 'running';
  const label = running
    ? 'Analysing…'
    : analysis.phase === 'done' || analysis.phase === 'error'
      ? 'Run again'
      : 'Run analysis';
  return (
    <button
      type="button"
      className="btn primary"
      onClick={onRun}
      disabled={running}
      title={running ? 'Analysis is running' : `${label} (r)`}
    >
      {label}
    </button>
  );
}

/**
 * Indeterminate progress text with elapsed seconds, in the findings column only. The API does
 * not report steps, so no step list is shown. The ticking text is deliberately not a live
 * region; start, completion and failure are announced separately.
 */
export function RunStatus({ analysis }: { analysis: Analysis }) {
  const seconds = useElapsedSeconds(analysis.phase === 'running' ? analysis.startedAt : null);
  if (analysis.phase !== 'running') return null;
  return (
    <div className="run-status">
      Analysing… <span className="mono">{seconds} s</span> elapsed, waiting for the API.
    </div>
  );
}
