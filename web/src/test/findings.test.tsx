import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FindingResult, PredictionResponse } from '../api/types';
import { FindingRow } from '../components/findings/FindingRow';
import { ProvenanceStrip } from '../components/findings/ProvenanceStrip';
import { example } from './examples';
import { CHECKPOINT_SHA, cachedResponse, liveResponse } from './testResponses';

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
      <FindingRow
        finding={f}
        source={source}
        onToggleLabel={() => {}}
        onRetryLabel={() => {}}
        onRetry={() => {}}
      />
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

  it('draws the score bar in a neutral colour whatever the value', () => {
    const low = renderRow(byStatus(fixture, 'scored', 'mcl'), 'fixture');
    const lowBar = low.container.querySelector<HTMLElement>('.bar i');
    low.unmount();
    const high = renderRow(byStatus(fixture, 'scored', 'acl'), 'fixture');
    const highBar = high.container.querySelector<HTMLElement>('.bar i');
    expect(lowBar?.style.width).toBe('7%');
    expect(highBar?.style.width).toBe('71%');
    for (const bar of [lowBar, highBar]) {
      expect(bar?.getAttribute('style')).toBe(`width: ${bar?.style.width};`);
      expect(bar?.style.background).toBe('');
      expect(bar?.style.backgroundColor).toBe('');
    }
    expect(high.container.querySelector('li')?.className).not.toMatch(/low|high|positive/);
  });

  it('shows threshold text only when a validated threshold exists', () => {
    // Test data: a scored finding with a threshold (the fixture example has none).
    const withThreshold: FindingResult = {
      ...byStatus(fixture, 'scored', 'acl'),
      threshold: 0.5,
      above_threshold: true,
    };
    const below: FindingResult = { ...withThreshold, score: 0.2, above_threshold: false };
    const a = renderRow(withThreshold, 'live');
    expect(screen.getByText(/Above threshold/)).toBeInTheDocument();
    expect(a.container.querySelector('.bar b')).not.toBeNull();
    a.unmount();
    const b = renderRow(below, 'live');
    expect(screen.getByText(/Below threshold/)).toBeInTheDocument();
    b.unmount();
    const none = renderRow(byStatus(fixture, 'scored', 'acl'), 'fixture');
    expect(none.container.textContent).not.toMatch(/threshold/i);
    expect(none.container.querySelector('.bar b')).toBeNull();
  });

  it('puts the hatched fixture stripe on fixture rows only', () => {
    const f = renderRow(byStatus(fixture, 'scored', 'acl'), 'fixture');
    expect(f.container.querySelector('li')).toHaveClass('fixture');
    f.unmount();
    for (const source of ['live', 'cached'] as const) {
      const r = renderRow(byStatus(fixture, 'scored', 'acl'), source);
      expect(r.container.querySelector('li')).not.toHaveClass('fixture');
      r.unmount();
    }
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

describe('ProvenanceStrip sources', () => {
  it('cached: CACHED badge with the original timestamp and short checkpoint, no latency', () => {
    const cached = cachedResponse();
    const { container } = render(<ProvenanceStrip result={cached} />);
    expect(screen.getByText('CACHED')).toBeInTheDocument();
    expect(container.querySelector('.badge.cached')).toHaveTextContent(
      `from ${cached.provenance.computed_at}, checkpoint ${CHECKPOINT_SHA.slice(0, 8)}`,
    );
    expect(screen.getByText('Originally computed')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/latency/i);
    expect(container.textContent).not.toMatch(/computed now/i);
    expect(container.textContent).not.toMatch(/LIVE|FIXTURE/);
    expect(screen.getByText(/test-model test-1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(CHECKPOINT_SHA.slice(0, 8))).toBeInTheDocument();
  });

  it('live: LIVE badge with latency, versions and checkpoint', () => {
    const live = liveResponse();
    const { container } = render(<ProvenanceStrip result={live} />);
    expect(screen.getByText(/^LIVE/)).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('1234 ms')).toBeInTheDocument();
    expect(screen.getByText(/test-model test-1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(live.preprocessing.version)).toBeInTheDocument();
    expect(screen.getByText(CHECKPOINT_SHA.slice(0, 8))).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/CACHED|FIXTURE/);
  });

  it('fixture: no latency and no checkpoint', () => {
    const { container } = render(<ProvenanceStrip result={fixture} />);
    expect(container.textContent).not.toMatch(/latency/i);
    expect(container.textContent).not.toMatch(/computed now/i);
    expect(screen.getByText('Checkpoint').nextElementSibling).toHaveTextContent('none');
  });
});
