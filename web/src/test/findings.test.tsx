import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FindingResult, PredictionResponse } from '../api/types';
import { FindingRow } from '../components/findings/FindingRow';
import { ProvenanceStrip } from '../components/findings/ProvenanceStrip';
import { example } from './examples';

const fixture = example<PredictionResponse>('prediction-fixture').body;
const missingPlane = example<PredictionResponse>('prediction-missing-plane').body;

function byStatus(p: PredictionResponse, status: FindingResult['status'], id?: string) {
  const f = p.findings.find((x) => x.status === status && (id ? x.finding_id === id : true));
  if (!f) throw new Error(`example has no ${status} finding`);
  return f;
}

function renderRow(f: FindingResult, source: PredictionResponse['provenance']['source'] | null) {
  return render(
    <ul>
      <FindingRow finding={f} source={source} onRevealLabel={() => {}} onRetry={() => {}} />
    </ul>,
  );
}

describe('FindingRow', () => {
  it('renders a low score as scored, never as failed', () => {
    renderRow(byStatus(fixture, 'scored', 'mcl'), 'fixture');
    expect(screen.getByText('0.07')).toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    expect(screen.getByRole('group')).toHaveAccessibleName(
      'MCL, model score 0.07, fixture, not a model output',
    );
  });

  it('renders each of the five statuses distinctly', () => {
    const notEvaluated: FindingResult = {
      finding_id: 'acl',
      display_name: 'ACL',
      status: 'not_evaluated',
      explanation_available: false,
    };
    const cases: [FindingResult, RegExp][] = [
      [byStatus(fixture, 'scored', 'acl'), /^0\.71$/],
      [notEvaluated, /^Not evaluated$/],
      [byStatus(missingPlane, 'unavailable'), /Unavailable — Sagittal series missing/],
      [byStatus(fixture, 'unsupported'), /^Not supported by this model$/],
      [byStatus(fixture, 'failed'), /Analysis failed — INFERENCE_FAILED/],
    ];
    const statuses = new Set<string>();
    for (const [finding, text] of cases) {
      const { container, unmount } = renderRow(
        finding,
        finding === notEvaluated ? null : 'fixture',
      );
      expect(container.querySelector('li')).toHaveAttribute('data-status', finding.status);
      expect(container.querySelector('.finding-state, .finding-score')?.textContent).toMatch(text);
      statuses.add(finding.status);
      unmount();
    }
    expect(statuses.size).toBe(5);
  });

  it('shows no score bar for non-scored states', () => {
    const { container } = renderRow(byStatus(fixture, 'failed'), 'fixture');
    expect(container.querySelector('.bar')).toBeNull();
  });
});

describe('ProvenanceStrip', () => {
  it('labels fixture results as not a model output', () => {
    render(<ProvenanceStrip result={fixture} />);
    expect(screen.getByText('FIXTURE — not a model output')).toBeInTheDocument();
    expect(screen.getByText(/fixture-model/)).toBeInTheDocument();
    expect(screen.getByText(fixture.preprocessing.version)).toBeInTheDocument();
  });
});
