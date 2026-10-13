import type { MetricsSnapshot } from '../../api/types';
import { formatMetric } from './MetricCell';

/** Macro ROC AUC with how many findings it includes and which were excluded, and why. */
export function MacroAucLine({ macro }: { macro: NonNullable<MetricsSnapshot['macro_roc_auc']> }) {
  const n = macro.included.length;
  return (
    <p className="macro-auc">
      <strong>Macro ROC AUC</strong>{' '}
      <span className="mono">{macro.value != null ? formatMetric(macro.value) : 'Undefined'}</span>{' '}
      over {n} included {n === 1 ? 'finding' : 'findings'}
      {n > 0 ? ` (${macro.included.join(', ')})` : ''}.{' '}
      {macro.excluded.length > 0 ? (
        <>
          Excluded:{' '}
          {macro.excluded.map((r, i) => (
            <span key={r.code}>
              {i > 0 ? '; ' : ''}
              {r.code} — {r.message}
            </span>
          ))}
          .
        </>
      ) : (
        'No findings excluded.'
      )}
    </p>
  );
}
