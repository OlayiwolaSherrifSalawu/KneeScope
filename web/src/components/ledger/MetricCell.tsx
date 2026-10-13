import type { MetricValue } from '../../api/types';

/** Two-decimal plain number. Metrics are never rendered as percentages (DESIGN.md section 9.11). */
export function formatMetric(value: number): string {
  return value.toFixed(2);
}

/**
 * One MetricValue cell. `defined` prints a 2-decimal mono value; the other statuses print
 * words (never a number) so a missing metric cannot be mistaken for a measured zero.
 * `nPositive` completes the undefined-AUC wording: "Undefined — one class only (n+ = N)".
 */
export function MetricCell({
  metric,
  nPositive,
  note,
}: {
  metric: MetricValue;
  nPositive?: number;
  /** Secondary line for a defined value, e.g. the threshold a sensitivity is read at. */
  note?: string | null;
}) {
  if (metric.status === 'defined' && metric.value != null) {
    return (
      <td>
        <span className="metric-value">{formatMetric(metric.value)}</span>
        {note ? <span className="metric-note">{note}</span> : null}
      </td>
    );
  }
  if (metric.status === 'undefined_single_class') {
    return (
      <td className="undef">
        Undefined — one class only{nPositive != null ? ` (n+ = ${nPositive})` : ''}
        {metric.reason ? <span className="metric-note">{metric.reason}</span> : null}
      </td>
    );
  }
  return (
    <td className="undef">
      Not computed
      {metric.reason ? <span className="metric-note">{metric.reason}</span> : null}
    </td>
  );
}
