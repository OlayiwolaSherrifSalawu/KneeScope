import type { MetricsSnapshot } from '../../api/types';

/** Measured inference cost, or an explicit "Not measured". Nothing is estimated. */
export function InferenceBlock({ inference }: { inference: MetricsSnapshot['inference'] }) {
  return (
    <section aria-labelledby="inference-heading">
      <h3 id="inference-heading">Inference measurements</h3>
      {inference ? (
        <dl className="facts">
          <div>
            <dt>Latency p50</dt>
            <dd className="mono">{inference.latency_ms_p50.toFixed(0)} ms</dd>
          </div>
          <div>
            <dt>Latency p95</dt>
            <dd className="mono">{inference.latency_ms_p95.toFixed(0)} ms</dd>
          </div>
          <div>
            <dt>Peak memory</dt>
            <dd className="mono">{inference.peak_memory_mb.toFixed(0)} MB</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd className="mono">{inference.n_runs}</dd>
          </div>
          <div>
            <dt>Hardware</dt>
            <dd>{inference.hardware}</dd>
          </div>
        </dl>
      ) : (
        <p className="reason">Not measured</p>
      )}
    </section>
  );
}
