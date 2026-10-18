import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FindingMetrics, MetricValue, MetricsSnapshot, ModelCard } from '../api/types';
import { MetricsLedger } from '../components/MetricsLedger';
import { ModelCardView } from '../components/ModelCardView';
import { example } from './examples';

const unavailable = example<MetricsSnapshot>('metrics-unavailable').body;

// ---------------------------------------------------------------------------------------------
// TEST DATA ONLY. Invented numbers used to exercise rendering paths. This is NOT an evaluation
// result, is not a fixture, and must never be added to contracts/examples or shipped.
// ---------------------------------------------------------------------------------------------
const defined = (value: number): MetricValue => ({ status: 'defined', value });
const notComputed = (reason: string): MetricValue => ({
  status: 'not_computed',
  value: null,
  reason,
});

const scoredFinding: FindingMetrics = {
  finding_id: 'acl',
  n_positive: 12,
  n_negative: 38,
  n_unknown: 3,
  roc_auc: defined(0.8),
  pr_auc: defined(0.612),
  prevalence: 0.24,
  threshold: 0.5,
  threshold_selected_on: 'validation',
  sensitivity: defined(0.75),
  specificity: defined(0.9),
  brier: defined(0.12),
};
const singleClassFinding: FindingMetrics = {
  finding_id: 'pcl',
  n_positive: 0,
  n_negative: 50,
  n_unknown: 0,
  roc_auc: { status: 'undefined_single_class', value: null, reason: 'No positive cases.' },
  pr_auc: notComputed('No positive cases.'),
  prevalence: 0,
  threshold: null,
  threshold_selected_on: null,
  sensitivity: notComputed('No threshold selected.'),
  specificity: notComputed('No threshold selected.'),
  brier: notComputed('n/a'),
};
const availableTestData: MetricsSnapshot = {
  ...unavailable,
  status: 'available',
  reason: null,
  origin: 'dataset',
  dataset_id: 'synthetic-dataset-for-tests',
  partition: 'validation',
  split_method: 'patient-grouped 80/20',
  grouping_unit: 'patient',
  n_studies: 50,
  created_at: '2030-01-02T03:04:05Z',
  model: {
    model_id: 'test-model',
    model_version: 'v9',
    finding_profile: 'p',
    supported_findings: ['acl', 'pcl'],
    checkpoint_sha256: null,
    trained_on: null,
  },
  preprocessing: { version: 'prep-test-1', config_sha256: null },
  per_finding: [scoredFinding, singleClassFinding],
  macro_roc_auc: {
    value: 0.8,
    included: ['acl'],
    excluded: [{ code: 'pcl', message: 'ROC AUC undefined: one class only' }],
  },
  inference: null,
};
// ---------------------------------------------------------------------------------------------

function renderAvailable(patch: Partial<MetricsSnapshot> = {}) {
  return render(<MetricsLedger snapshot={{ ...availableTestData, ...patch }} />);
}

describe('MetricsLedger unavailable (contracts/examples/metrics-unavailable.json)', () => {
  it('renders "Metrics unavailable" with the reason and no numeric cells', () => {
    const { container } = render(<MetricsLedger snapshot={unavailable} />);
    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    expect(screen.getByText(unavailable.reason ?? '')).toBeInTheDocument();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toMatch(/\d\.\d{2}/);
    expect(container.textContent).not.toMatch(/%/);
  });
});

describe('MetricsLedger available (test data)', () => {
  it('shows header facts and counts per finding', () => {
    renderAvailable();
    const facts = document.querySelector('.facts') as HTMLElement;
    for (const text of [
      'synthetic-dataset-for-tests',
      'patient-grouped 80/20',
      'Patient',
      'test-model v9',
      'prep-test-1',
      '2030-01-02T03:04:05Z',
    ]) {
      expect(within(facts).getByText(text)).toBeInTheDocument();
    }
    const row = screen.getByRole('row', { name: /^acl/ });
    const cells = within(row)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells.slice(0, 3)).toEqual(['12', '38', '3']);
  });

  it('renders a defined metric as a 2-decimal mono value', () => {
    renderAvailable();
    const row = screen.getByRole('row', { name: /^acl/ });
    expect(within(row).getByText('0.80')).toHaveClass('metric-value');
    expect(within(row).getByText('0.61')).toBeInTheDocument();
    expect(within(row).queryByText('0.612')).toBeNull();
  });

  it('renders undefined_single_class as "Undefined — one class only (n+ = 0)"', () => {
    renderAvailable();
    const row = screen.getByRole('row', { name: /^pcl/ });
    expect(
      within(row).getByText('Undefined — one class only (n+ = 0)', { exact: false }),
    ).toBeInTheDocument();
    const rocCell = within(row).getByText(/^Undefined — one class only/);
    expect(rocCell.textContent).not.toMatch(/\d\.\d{2}/);
  });

  it('renders not_computed as "Not computed" with its reason, never a number', () => {
    renderAvailable();
    const row = screen.getByRole('row', { name: /^pcl/ });
    expect(within(row).getAllByText(/^Not computed/).length).toBeGreaterThanOrEqual(3);
    expect(within(row).getAllByText('No threshold selected.')).toHaveLength(2);
  });

  it('names the threshold behind sensitivity and specificity', () => {
    renderAvailable();
    const row = screen.getByRole('row', { name: /^acl/ });
    expect(within(row).getAllByText('@ 0.50, set on validation')).toHaveLength(2);
  });

  it('prints partition "validation" as Validation, never as Test', () => {
    const { container } = renderAvailable({ partition: 'validation' });
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Held-out/);
    expect(container.textContent).not.toMatch(/\bTest\b/);
  });

  it('prints partition "test" as Held-out test', () => {
    renderAvailable({ partition: 'test' });
    expect(screen.getByText('Held-out test')).toBeInTheDocument();
    expect(screen.queryByText('Validation')).toBeNull();
  });

  it('does not guess a partition when none is given', () => {
    renderAvailable({ partition: null });
    expect(screen.queryByText('Validation')).toBeNull();
    expect(screen.queryByText('Held-out test')).toBeNull();
  });

  it('macro AUC line names the included count and the excluded findings', () => {
    renderAvailable();
    const line = document.querySelector('.macro-auc') as HTMLElement;
    expect(line).toHaveTextContent('Macro ROC AUC 0.80 over 1 included finding (acl).');
    expect(line).toHaveTextContent('Excluded: pcl — ROC AUC undefined: one class only.');
  });

  it('macro AUC with nothing excluded says so', () => {
    renderAvailable({ macro_roc_auc: { value: 0.8, included: ['acl'], excluded: [] } });
    expect(document.querySelector('.macro-auc')).toHaveTextContent('No findings excluded.');
  });

  it('shows "Not measured" when inference is null, and the measurements when present', () => {
    const { unmount } = renderAvailable();
    expect(screen.getByText('Not measured')).toBeInTheDocument();
    unmount();
    renderAvailable({
      inference: {
        hardware: 'test-gpu',
        latency_ms_p50: 120.4,
        latency_ms_p95: 250.6,
        peak_memory_mb: 2048,
        n_runs: 30,
      },
    });
    expect(screen.queryByText('Not measured')).toBeNull();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('251 ms')).toBeInTheDocument();
    expect(screen.getByText('2048 MB')).toBeInTheDocument();
    expect(screen.getByText('test-gpu')).toBeInTheDocument();
  });

  it('never shows scores, AUC or prevalence as percentages', () => {
    const { container } = renderAvailable({
      inference: {
        hardware: 'h',
        latency_ms_p50: 1,
        latency_ms_p95: 2,
        peak_memory_mb: 3,
        n_runs: 4,
      },
    });
    expect(container.textContent).not.toMatch(/%/);
    expect(within(screen.getByRole('row', { name: /^acl/ })).getByText('0.24')).toBeInTheDocument();
  });
});

describe('ModelCardView', () => {
  const card = example<ModelCard>('model-card').body;

  it('renders every section and numbered limitations', () => {
    render(<ModelCardView card={card} />);
    for (const s of card.sections) {
      expect(screen.getByRole('heading', { name: s.title })).toBeInTheDocument();
    }
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(card.limitations.length);
    expect(screen.getByRole('heading', { name: 'Limitations' })).toBeInTheDocument();
  });

  it('adds a Versions section and a Draft stamp for a draft card', () => {
    render(<ModelCardView card={card} />);
    expect(screen.getByRole('heading', { name: 'Versions' })).toBeInTheDocument();
    expect(screen.getByText('No model')).toBeInTheDocument();
    expect(screen.getByText('prep-0.0.0-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
