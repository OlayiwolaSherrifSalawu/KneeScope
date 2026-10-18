import { useEffect } from 'react';
import { api } from '../api/client';
import { ErrorPanel } from '../components/ErrorPanel';
import { MetricsLedger } from '../components/MetricsLedger';
import { ModelCardView } from '../components/ModelCardView';
import { useAsync } from '../hooks/useAsync';
import { customModelStore } from '../store/customModelStore';

export function EvaluationPage() {
  const metrics = useAsync('metrics', (signal) => api.metrics({ signal }));
  const card = useAsync('model-card', (signal) => api.modelCard({ signal }));

  useEffect(() => {
    return customModelStore.subscribe(() => {
      metrics.reload();
      card.reload();
    });
  }, [metrics, card]);
  return (
    <div className="ledger-wrap">
      <article className="ledger">
        <div className="kicker">Evaluation ledger</div>
        <h1>Model evaluation</h1>
        <p className="lede">
          Measured results and model documentation. Numbers appear here only when a real evaluation
          snapshot exists.
        </p>

        <h2>
          <span className="n">1</span>Metrics
        </h2>
        <div aria-busy={metrics.phase === 'loading'}>
          {metrics.phase === 'loading' ? <p className="reason">Loading metrics…</p> : null}
          {metrics.phase === 'error' ? (
            <ErrorPanel
              error={metrics.error}
              title="Metrics could not be loaded"
              onRetry={metrics.reload}
            />
          ) : null}
          {metrics.phase === 'ready' ? <MetricsLedger snapshot={metrics.data} /> : null}
        </div>

        <h2>
          <span className="n">2</span>Model card
        </h2>
        <div aria-busy={card.phase === 'loading'}>
          {card.phase === 'loading' ? <p className="reason">Loading model card…</p> : null}
          {card.phase === 'error' ? (
            <ErrorPanel
              error={card.error}
              title="Model card could not be loaded"
              onRetry={card.reload}
            />
          ) : null}
          {card.phase === 'ready' ? <ModelCardView card={card.data} /> : null}
        </div>
      </article>
    </div>
  );
}
