import type { DatasetLabel, FindingResult, ResultSource } from '../../api/types';
import { StateGlyph } from '../StateGlyph';

export type LabelReveal =
  | { phase: 'loading' }
  | { phase: 'ready'; label: DatasetLabel | null }
  | { phase: 'error'; message: string; code: string };

const STATE_TEXT: Record<DatasetLabel['state'], string> = {
  positive: 'Positive',
  negative: 'Negative',
  unknown: 'Unknown (not labelled)',
  not_labeled: 'Not labelled (outside the labelled subset)',
};

const PROVENANCE_TEXT: Record<DatasetLabel['provenance'], string> = {
  expert_annotation: 'Expert annotation',
  dataset_provided: 'Dataset-provided',
  report_extracted: 'Extracted from report',
  fixture: 'Fixture',
};

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
  onRevealLabel,
  onRetry,
}: {
  finding: FindingResult;
  /** Source of the displayed result; null before any analysis has run. */
  source: ResultSource | null;
  reveal?: LabelReveal;
  onRevealLabel: () => void;
  onRetry?: () => void;
}) {
  const scored = f.status === 'scored' && f.score != null;
  return (
    <li
      className={`finding ${f.status}${source === 'fixture' ? ' fixture' : ''}`}
      data-status={f.status}
    >
      <div role="group" aria-label={accessibleName(f, source)}>
        <div className="finding-main">
          <StateGlyph status={f.status} />
          <span className="finding-name">{f.display_name}</span>
          <StateText f={f} />
        </div>
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
          <div className="finding-actions">
            <button
              type="button"
              className="btn quiet"
              onClick={onRevealLabel}
              disabled={reveal?.phase === 'loading'}
              aria-label={`Reveal dataset label for ${f.display_name}`}
            >
              Reveal dataset label
            </button>
          </div>
          {reveal ? <LabelView reveal={reveal} /> : null}
        </div>
      </div>
    </li>
  );
}

function LabelView({ reveal }: { reveal: LabelReveal }) {
  if (reveal.phase === 'loading') return <div className="label-reveal">Loading dataset label…</div>;
  if (reveal.phase === 'error') {
    return (
      <div className="label-reveal" role="alert">
        Dataset label unavailable — <span className="mono">{reveal.code}</span>
      </div>
    );
  }
  const { label } = reveal;
  if (!label) return <div className="label-reveal">No dataset label for this finding.</div>;
  return (
    <div className="label-reveal">
      <div>Dataset label: {STATE_TEXT[label.state]}</div>
      <div className="faint">
        {PROVENANCE_TEXT[label.provenance]}
        {label.source_ref ? <span className="mono"> · {label.source_ref}</span> : null}
      </div>
    </div>
  );
}
