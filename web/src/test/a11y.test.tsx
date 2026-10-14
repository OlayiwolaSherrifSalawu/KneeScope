import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Health,
  MetricsSnapshot,
  ModelCard,
  PredictionResponse,
  StudyDetail,
  StudyList,
} from '../api/types';
import { App } from '../App';
import { example } from './examples';
import { FakeImage, json, mockApi, stubCanvas, type Handler } from './mockApi';

const health = example<Health>('health').body;
const studies = example<StudyList>('studies').body;
const study = example<StudyDetail>('study-detail').body;
const prediction = example<PredictionResponse>('prediction-fixture').body;
const missingPlane = example<PredictionResponse>('prediction-missing-plane').body;
const failed = example('error-preprocessing-failed');
const unavailableMetrics = example<MetricsSnapshot>('metrics-unavailable').body;
const modelCard = example<ModelCard>('model-card').body;

// Test data only (never shipped): an "available" snapshot to exercise every ledger state.
const availableMetrics: MetricsSnapshot = {
  schema_version: '0.1.0',
  status: 'available',
  origin: 'dataset',
  reason: null,
  model: {
    model_id: 'test-model',
    model_version: '1.0.0',
    checkpoint_sha256: 'ab'.repeat(32),
    finding_profile: 'rsna4',
    supported_findings: ['acl', 'mcl'],
    trained_on: 'test',
  },
  preprocessing: { version: 'prep-1.0.0', config_sha256: null },
  dataset_id: 'test',
  partition: 'validation',
  split_method: 'grouped',
  grouping_unit: 'patient',
  n_studies: 40,
  per_finding: [
    {
      finding_id: 'acl',
      n_positive: 10,
      n_negative: 28,
      n_unknown: 2,
      roc_auc: { status: 'defined', value: 0.71, reason: null },
      pr_auc: { status: 'defined', value: 0.44, reason: null },
      prevalence: 0.26,
      threshold: 0.5,
      threshold_selected_on: 'validation',
      sensitivity: { status: 'defined', value: 0.6, reason: null },
      specificity: { status: 'defined', value: 0.75, reason: null },
      brier: { status: 'defined', value: 0.2, reason: null },
    },
    {
      finding_id: 'mcl',
      n_positive: 0,
      n_negative: 40,
      n_unknown: 0,
      roc_auc: { status: 'undefined_single_class', value: null, reason: 'No positives.' },
      pr_auc: { status: 'undefined_single_class', value: null, reason: 'No positives.' },
      prevalence: 0,
      threshold: null,
      threshold_selected_on: null,
      sensitivity: { status: 'not_computed', value: null, reason: 'No positives.' },
      specificity: { status: 'not_computed', value: null, reason: 'No threshold.' },
      brier: { status: 'defined', value: 0.05, reason: null },
    },
  ],
  macro_roc_auc: {
    value: 0.71,
    included: ['acl'],
    excluded: [{ code: 'mcl', message: 'No positives.' }],
  },
  calibration: 'not_assessed',
  inference: null,
  created_at: '2026-10-14T00:00:00Z',
};

beforeEach(() => {
  FakeImage.srcs = [];
  vi.stubGlobal('Image', FakeImage);
  stubCanvas();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Serious or critical axe violations. Colour contrast is verified by
 * scripts/check_design_tokens.py (jsdom cannot compute rendered colours). */
async function seriousViolations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

function renderAt(path: string, routes: Record<string, Handler> = {}) {
  mockApi({
    'GET /healthz': () => json(health),
    'GET /studies': () => json(studies),
    'GET /metrics': () => json(unavailableMetrics),
    'GET /model-card': () => json(modelCard),
    ...routes,
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Accessibility (KS-WEB-07): no serious or critical axe violations', () => {
  it('Studies: populated', async () => {
    renderAt('/');
    await screen.findByText(study.study_id, { exact: false });
    expect(await seriousViolations()).toEqual([]);
  });

  it('Studies: empty', async () => {
    renderAt('/', { 'GET /studies': () => json({ studies: [], origin_notice: null }) });
    await screen.findAllByText(/No permitted studies/);
    expect(await seriousViolations()).toEqual([]);
  });

  it('Studies: error', async () => {
    renderAt('/', { 'GET /studies': () => json(failed.body, 503) });
    await screen.findByRole('alert');
    expect(await seriousViolations()).toEqual([]);
  });

  it('Review: not evaluated', async () => {
    renderAt(`/studies/${study.study_id}`);
    await screen.findByRole('button', { name: /run analysis/i });
    expect(await seriousViolations()).toEqual([]);
  });

  it('Review: scored, failed and unsupported findings with fixture provenance', async () => {
    renderAt(`/studies/${study.study_id}`, { 'POST /predictions': () => json(prediction) });
    await userEvent.click(await screen.findByRole('button', { name: /run analysis/i }));
    await screen.findByText(/FIXTURE — not a model output/);
    expect(await seriousViolations()).toEqual([]);
  });

  it('Review: unavailable findings (missing plane)', async () => {
    renderAt(`/studies/${study.study_id}`, { 'POST /predictions': () => json(missingPlane) });
    await userEvent.click(await screen.findByRole('button', { name: /run analysis/i }));
    await screen.findAllByText(/Unavailable/);
    expect(await seriousViolations()).toEqual([]);
  });

  it('Review: study-level analysis failure', async () => {
    renderAt(`/studies/${study.study_id}`, { 'POST /predictions': () => json(failed.body, 422) });
    await userEvent.click(await screen.findByRole('button', { name: /run analysis/i }));
    await waitFor(() => expect(screen.getAllByText(/Analysis failed/).length).toBeGreaterThan(0));
    expect(await seriousViolations()).toEqual([]);
  });

  it('Evaluation: metrics unavailable', async () => {
    renderAt('/evaluation');
    await screen.findAllByText(/Metrics unavailable/i);
    expect(await seriousViolations()).toEqual([]);
  });

  it('Evaluation: metrics available', async () => {
    renderAt('/evaluation', { 'GET /metrics': () => json(availableMetrics) });
    await screen.findAllByText(/Undefined — one class only/);
    expect(await seriousViolations()).toEqual([]);
  });
});

describe('axe harness control', () => {
  it('catches a seeded violation, so a pass above is meaningful', async () => {
    render(<button type="button" />); // no accessible name: axe "button-name" (critical)
    expect((await seriousViolations()).some((v) => v.startsWith('button-name'))).toBe(true);
  });
});
