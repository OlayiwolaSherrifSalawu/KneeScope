import type { PredictionResponse } from '../../api/types';
import { HatchBlock } from '../StateGlyph';
import { Clock } from 'lucide-react';

function SourceBadge({ p }: { p: PredictionResponse }) {
  const { provenance, model } = p;
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
            from {provenance.computed_at}, checkpoint {model.checkpoint_sha256?.slice(0, 8)}
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

/** Provenance is always visible once a result exists (DESIGN.md section 9.7). */
export function ProvenanceStrip({ result }: { result: PredictionResponse }) {
  const { provenance, model, preprocessing } = result;
  return (
    <section className="prov" aria-label="Result provenance">
      <SourceBadge p={result} />
      <dl>
        <dt>Model</dt>
        <dd>
          {model.model_id} {model.model_version}
        </dd>
        <dt>Preprocessing</dt>
        <dd>{preprocessing.version}</dd>
        {provenance.computed_at ? (
          <>
            <dt>Computed</dt>
            <dd>{provenance.computed_at}</dd>
          </>
        ) : null}
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
