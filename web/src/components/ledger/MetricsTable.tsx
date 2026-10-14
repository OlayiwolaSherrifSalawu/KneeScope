import type { FindingMetrics } from '../../api/types';
import { MetricCell, formatMetric } from './MetricCell';

function thresholdNote(f: FindingMetrics): string | null {
  if (f.threshold == null) return null;
  const on = f.threshold_selected_on ? `, set on ${f.threshold_selected_on}` : '';
  return `@ ${formatMetric(f.threshold)}${on}`;
}

/** DESIGN.md section 9.11 columns, with the counts every metric rests on. */
export function MetricsTable({ rows }: { rows: FindingMetrics[] }) {
  return (
    <div
      className="ledger-table-wrap"
      role="region"
      aria-label="Per-finding metrics (scrolls horizontally on narrow screens)"
      tabIndex={0}
    >
      <table className="metrics">
        <caption className="sr-only">Per-finding metrics</caption>
        <thead>
          <tr>
            <th scope="col">Finding</th>
            <th scope="col">Positives</th>
            <th scope="col">Negatives</th>
            <th scope="col">Unknown (excluded)</th>
            <th scope="col">ROC AUC</th>
            <th scope="col">PR AUC</th>
            <th scope="col">Prevalence</th>
            <th scope="col">Sensitivity @ threshold</th>
            <th scope="col">Specificity @ threshold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.finding_id}>
              <th scope="row">{f.finding_id}</th>
              <td>{f.n_positive}</td>
              <td>{f.n_negative}</td>
              <td>{f.n_unknown}</td>
              <MetricCell metric={f.roc_auc} nPositive={f.n_positive} />
              <MetricCell metric={f.pr_auc} nPositive={f.n_positive} />
              <td>{f.prevalence != null ? formatMetric(f.prevalence) : '—'}</td>
              <MetricCell metric={f.sensitivity} note={thresholdNote(f)} />
              <MetricCell metric={f.specificity} note={thresholdNote(f)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
