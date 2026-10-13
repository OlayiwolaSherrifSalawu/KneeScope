import { Clock } from 'lucide-react';
import type { PredictionResponse } from '../../api/types';
import { HatchBlock } from '../StateGlyph';

/** First 8 hex characters of a checkpoint SHA-256, for display. */
export function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, 8) : null;
}

function SourceBadge({ result }: { result: PredictionResponse }) {
  const { provenance, model } = result;
  switch (provenance.source) {
    case 'fixture':
      return (
        <span className="badge fixture">
          <HatchBlock />
          <span>FIXTURE — not a model output</span>
        </span>
      );
    case 'cached':
      return (
        <span className="badge cached">
          <Clock className="i" aria-hidden="true" />
          CACHED
          <span className="mono" style={{ fontWeight: 400 }}>
            from {provenance.computed_at ?? 'unknown time'}, checkpoint{' '}
            {shortSha(model.checkpoint_sha256) ?? 'unknown'}
          </span>
        </span>
      );
    case 'live':
      return (
        <span className="badge live">
          <svg className="glyph" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="4" y="4" width="8" height="8" fill="currentColor" />
          </svg>
          LIVE · computed now
        </span>
      );
  }
}

/**
 * Provenance is always visible once a result exists (DESIGN.md section 9.7): source badge,
 * model and preprocessing versions, checkpoint, original computation time, and latency for
 * live results only. A cached result never shows "computed now" or a latency.
 */
export function ProvenanceStrip({ result }: { result: PredictionResponse }) {
  const { provenance, model, preprocessing } = result;
  const checkpoint = shortSha(model.checkpoint_sha256);
  return (
    <section className="prov" aria-label="Result provenance" data-source={provenance.source}>
      <SourceBadge result={result} />
      <dl>
        <dt>Model</dt>
        <dd>
          {model.model_id} {model.model_version}
        </dd>
        <dt>Checkpoint</dt>
        <dd>{checkpoint ?? <span className="faint">none</span>}</dd>
        <dt>Preprocessing</dt>
        <dd>{preprocessing.version}</dd>
        {provenance.computed_at ? (
          <>
            <dt>{provenance.source === 'cached' ? 'Originally computed' : 'Computed'}</dt>
            <dd>{provenance.computed_at}</dd>
          </>
        ) : null}
        <dt>Served</dt>
        <dd>{provenance.served_at}</dd>
        {provenance.source === 'live' && provenance.latency_ms != null ? (
          <>
            <dt>Latency</dt>
            <dd>{Math.round(provenance.latency_ms)} ms</dd>
          </>
        ) : null}
      </dl>
      {provenance.notice ? <span className="faint">{provenance.notice}</span> : null}
    </section>
  );
}
