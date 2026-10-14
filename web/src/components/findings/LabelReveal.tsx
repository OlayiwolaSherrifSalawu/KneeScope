import { useId } from 'react';
import type { ApiRequestError } from '../../api/client';
import type { DatasetLabel } from '../../api/types';

/** What the row shows for one finding once the reviewer has asked to see its label. */
export type LabelRevealState =
  | { phase: 'loading' }
  | { phase: 'ready'; label: DatasetLabel | null }
  | { phase: 'error'; error: ApiRequestError };

/** "unknown" is never worded as a negative (AGENTS.md section 16). */
export const LABEL_STATE_TEXT: Record<DatasetLabel['state'], string> = {
  positive: 'Positive',
  negative: 'Negative',
  unknown: 'Unknown (not labelled)',
  not_labeled: 'Not labelled',
};

const LABEL_STATE_NOTE: Partial<Record<DatasetLabel['state'], string>> = {
  not_labeled: 'This study is outside the labelled subset.',
};

export const LABEL_PROVENANCE_TEXT: Record<DatasetLabel['provenance'], string> = {
  expert_annotation: 'Expert annotation',
  dataset_provided: 'Dataset-provided',
  report_extracted: 'Extracted from report',
  fixture: 'Fixture',
};

/**
 * Per-finding "Reveal dataset label" action and its result (DESIGN.md section 9.10). The label
 * is a dataset label with provenance, not a statement about the patient, and it is fetched
 * from a separate endpoint on demand by the parent.
 */
export function LabelReveal({
  findingName,
  reveal,
  onToggle,
  onRetry,
}: {
  findingName: string;
  /** undefined while the label is hidden. */
  reveal: LabelRevealState | undefined;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const regionId = useId();
  const shown = reveal !== undefined;
  return (
    <>
      <div className="finding-actions">
        <button
          type="button"
          className="btn quiet"
          aria-expanded={shown}
          aria-controls={regionId}
          aria-label={`${shown ? 'Hide' : 'Reveal'} dataset label for ${findingName}`}
          onClick={onToggle}
        >
          {shown ? 'Hide dataset label' : 'Reveal dataset label'}
        </button>
      </div>
      <div id={regionId} aria-live="polite">
        {reveal ? <LabelView reveal={reveal} onRetry={onRetry} /> : null}
      </div>
    </>
  );
}

function LabelView({ reveal, onRetry }: { reveal: LabelRevealState; onRetry: () => void }) {
  if (reveal.phase === 'loading') {
    return <div className="label-reveal">Loading dataset label…</div>;
  }
  if (reveal.phase === 'error') {
    return (
      <div className="label-reveal" role="alert">
        <div>
          Dataset label unavailable — <span className="mono">{reveal.error.code}</span>
          {reveal.error.requestId ? (
            <span className="mono faint"> · request {reveal.error.requestId}</span>
          ) : null}
        </div>
        <button type="button" className="btn quiet" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  const { label } = reveal;
  if (!label) return <div className="label-reveal">No dataset label for this finding.</div>;
  const note = LABEL_STATE_NOTE[label.state];
  return (
    <div className="label-reveal" data-label-state={label.state}>
      <div>Dataset label: {LABEL_STATE_TEXT[label.state]}</div>
      {note ? <div className="faint">{note}</div> : null}
      <div className="faint">
        Provenance: {LABEL_PROVENANCE_TEXT[label.provenance]}
        {label.source_ref ? <span className="mono"> · {label.source_ref}</span> : null}
      </div>
    </div>
  );
}
