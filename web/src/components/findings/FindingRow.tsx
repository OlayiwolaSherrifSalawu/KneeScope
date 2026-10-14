import type { FindingResult, ResultSource } from '../../api/types';
import { StateGlyph } from '../StateGlyph';
import { LabelReveal, type LabelRevealState } from './LabelReveal';

export function formatScore(score: number): string {
  return score.toFixed(2);
}

/** Screen-reader name: finding, state, and provenance (DESIGN.md section 16). */
export function accessibleName(f: FindingResult, source: ResultSource | null): string {
  const prov =
    source === 'fixture' ? ', fixture, not a model output' : source ? `, ${source} result` : '';
  switch (f.status) {
    case 'scored':
      return `${f.display_name}, model score ${formatScore(f.score ?? 0)}${prov}`;
    case 'not_evaluated':
      return `${f.display_name}, not evaluated`;
    case 'unavailable':
      return `${f.display_name}, unavailable${prov}`;
    case 'unsupported':
      return `${f.display_name}, not supported by this model${prov}`;
    case 'failed':
      return `${f.display_name}, analysis failed${prov}`;
  }
}

function StateText({ f }: { f: FindingResult }) {
  switch (f.status) {
    case 'scored':
      return <span className="finding-score">{formatScore(f.score ?? 0)}</span>;
    case 'not_evaluated':
      return <span className="finding-state">Not evaluated</span>;
    case 'unavailable':
      return (
        <span className="finding-state">Unavailable{f.reason ? ` — ${f.reason.message}` : ''}</span>
      );
    case 'unsupported':
      return <span className="finding-state">Not supported by this model</span>;
    case 'failed':
      return (
        <span className="finding-state failed">
          Analysis failed — <span className="mono">{f.reason?.code ?? 'UNKNOWN'}</span>
        </span>
      );
  }
}

export function FindingRow({
  finding: f,
  source,
  reveal,
  onToggleLabel,
  onRetryLabel,
  onRetry,
  selected = false,
  onSelect,
}: {
  finding: FindingResult;
  /** Source of the displayed result; null before any analysis has run. */
  source: ResultSource | null;
  /** undefined while the dataset label is hidden. */
  reveal?: LabelRevealState;
  onToggleLabel: () => void;
  onRetryLabel: () => void;
  onRetry?: () => void;
  /** Selected for the explanation panel (DESIGN.md section 9.8). */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const scored = f.status === 'scored' && f.score != null;
  return (
    <li
      className={`finding ${f.status}${source === 'fixture' ? ' fixture' : ''}${selected ? ' selected' : ''}`}
      data-status={f.status}
      aria-current={selected ? 'true' : undefined}
    >
      <div role="group" aria-label={accessibleName(f, source)}>
        {onSelect ? (
          <button
            type="button"
            className="finding-main"
            aria-pressed={selected}
            aria-label={`Select ${f.display_name}`}
            onClick={onSelect}
          >
            <StateGlyph status={f.status} />
            <span className="finding-name">{f.display_name}</span>
            <StateText f={f} />
          </button>
        ) : (
          <div className="finding-main">
            <StateGlyph status={f.status} />
            <span className="finding-name">{f.display_name}</span>
            <StateText f={f} />
          </div>
        )}
        <div className="finding-sub">
          {scored ? (
            <>
              <div className="bar" aria-hidden="true">
                <i style={{ width: `${Math.round((f.score ?? 0) * 100)}%` }} />
                {f.threshold != null ? <b style={{ left: `${f.threshold * 100}%` }} /> : null}
              </div>
              {f.threshold != null && f.above_threshold != null ? (
                <span>
                  {f.above_threshold ? 'Above threshold' : 'Below threshold'} (
                  <span className="mono">{formatScore(f.threshold)}</span>)
                </span>
              ) : null}
            </>
          ) : null}
          {f.status === 'failed' && onRetry ? (
            <div className="finding-actions">
              <button type="button" className="btn quiet" onClick={onRetry}>
                Retry analysis
              </button>
            </div>
          ) : null}
          <LabelReveal
            findingName={f.display_name}
            reveal={reveal}
            onToggle={onToggleLabel}
            onRetry={onRetryLabel}
          />
        </div>
      </div>
    </li>
  );
}
