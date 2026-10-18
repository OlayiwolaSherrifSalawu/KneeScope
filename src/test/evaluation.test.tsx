import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MetricsSnapshot, ModelCard } from '../api/types';
import { MetricsLedger } from '../components/MetricsLedger';
import { ModelCardView } from '../components/ModelCardView';
import { example } from './examples';

describe('MetricsLedger', () => {
  it('shows "Metrics unavailable" with the reason and no numeric metric', () => {
    const snapshot = example<MetricsSnapshot>('metrics-unavailable').body;
    const { container } = render(<MetricsLedger snapshot={snapshot} />);
    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    expect(screen.getByText(snapshot.reason ?? '')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toMatch(/AUC/i);
    expect(container.textContent).not.toMatch(/\d\.\d{2}/);
  });

  it('prints undefined single-class AUC as undefined, never as a number', () => {
    const defined = { status: 'defined', value: 0.5 } as const;
    const snapshot: MetricsSnapshot = {
      ...example<MetricsSnapshot>('metrics-unavailable').body,
      status: 'available',
      reason: null,
      origin: 'dataset',
      dataset_id: 'test-set',
      partition: 'validation',
      split_method: 'patient-grouped',
      grouping_unit: 'patient',
      n_studies: 10,
      created_at: '2026-01-01T00:00:00Z',
      per_finding: [
        {
          finding_id: 'acl',
          n_positive: 0,
          n_negative: 10,
          n_unknown: 0,
          roc_auc: { status: 'undefined_single_class', value: null, reason: 'one class only' },
          pr_auc: { status: 'not_computed', value: null, reason: 'no positives' },
          prevalence: 0,
          threshold: null,
          threshold_selected_on: null,
          sensitivity: { status: 'not_computed', value: null, reason: 'no threshold' },
          specificity: defined,
          brier: { status: 'not_computed', value: null, reason: 'n/a' },
        },
      ],
    };
    render(<MetricsLedger snapshot={snapshot} />);
    expect(screen.getByText('Undefined — one class only (n+ = 0)')).toBeInTheDocument();
  });
});

describe('ModelCardView', () => {
  it('renders sections and numbered limitations from the API', () => {
    const card = example<ModelCard>('model-card').body;
    render(<ModelCardView card={card} />);
    for (const s of card.sections) {
      expect(screen.getByRole('heading', { name: s.title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(card.limitations.length);
  });
});
