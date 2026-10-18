import type { MetricsSnapshot } from '../../api/types';

/** DESIGN.md section 9.11: "Validation" or "Held-out test"; an absent partition is never guessed. */
export function partitionLabel(partition: MetricsSnapshot['partition']): string {
  if (partition === 'validation') return 'Validation';
  if (partition === 'test') return 'Held-out test';
  return '—';
}

const GROUPING = { patient: 'Patient', study: 'Study' } as const;

/** Header facts: dataset, partition, split method, grouping unit, versions, snapshot time. */
export function FactsBlock({ snapshot }: { snapshot: MetricsSnapshot }) {
  const facts: [string, string][] = [
    ['Dataset', snapshot.dataset_id ?? '—'],
    ['Partition', partitionLabel(snapshot.partition)],
    ['Split method', snapshot.split_method ?? '—'],
    ['Grouping unit', snapshot.grouping_unit ? GROUPING[snapshot.grouping_unit] : '—'],
    ['Studies', snapshot.n_studies != null ? String(snapshot.n_studies) : '—'],
    ['Model', snapshot.model ? `${snapshot.model.model_id} ${snapshot.model.model_version}` : '—'],
    ['Preprocessing', snapshot.preprocessing?.version ?? '—'],
    ['Snapshot', snapshot.created_at ?? '—'],
    ['Calibration', snapshot.calibration === 'assessed' ? 'Assessed' : 'Not assessed'],
  ];
  return (
    <dl className="facts">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
