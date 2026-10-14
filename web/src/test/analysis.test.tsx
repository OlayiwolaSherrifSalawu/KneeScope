import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, PredictionResponse, StudyDetail } from '../api/types';
import { ReviewPage } from '../pages/ReviewPage';
import { example } from './examples';
import { FakeImage, json, mockApi, stubCanvas } from './mockApi';
import { liveResponse } from './testResponses';

const fixture = example<PredictionResponse>('prediction-fixture').body;
const failure = example<ApiError>('error-preprocessing-failed');
const study = example<StudyDetail>('study-detail').body;

beforeEach(() => {
  FakeImage.srcs = [];
  vi.stubGlobal('Image', FakeImage);
  stubCanvas();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderReview() {
  return render(
    <MemoryRouter initialEntries={[`/studies/${study.study_id}`]}>
      <Routes>
        <Route path="studies/:studyId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const liveRegion = () => screen.getByRole('status');
const findings = () => screen.getByRole('complementary', { name: 'Findings' });

/** A POST /predictions handler the test settles by hand. */
function deferred() {
  let settle: (r: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { pending, settle: (r: Response) => act(async () => settle(r)) };
}

describe('run analysis', () => {
  it('disables the button while running, shows elapsed seconds, then offers Run again', async () => {
    const d = deferred();
    mockApi({ 'POST /predictions': () => d.pending });
    renderReview();
    const run = await screen.findByRole('button', { name: 'Run analysis' });
    expect(within(findings()).getAllByText('Not evaluated')).toHaveLength(4);

    vi.useFakeTimers();
    fireEvent.click(run);
    const busy = screen.getByRole('button', { name: 'Analysing…' });
    expect(busy).toBeDisabled();
    expect(liveRegion()).toHaveTextContent('Analysis started.');
    await act(async () => {
      vi.advanceTimersByTime(3200);
    });
    expect(findings()).toHaveTextContent('Analysing… 3 s elapsed');
    vi.useRealTimers();

    await d.settle(json(fixture));
    expect(liveRegion()).toHaveTextContent('Analysis complete.');
    expect(screen.getByRole('button', { name: 'Run again' })).toBeEnabled();
    expect(screen.queryByText(/elapsed/)).not.toBeInTheDocument();
  });

  it('announces start and completion in a polite live region', async () => {
    const d = deferred();
    mockApi({ 'POST /predictions': () => d.pending });
    renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run analysis' }));
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion()).toHaveTextContent('Analysis started.');
    await d.settle(json(fixture));
    expect(liveRegion()).toHaveTextContent(
      'Analysis complete. Fixture result, not a model output.',
    );
  });

  it('shows all five statuses, fixture provenance and hatched stripes after a fixture run', async () => {
    mockApi({ 'POST /predictions': () => json(fixture) });
    const { container } = renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run analysis' }));
    await screen.findByText('FIXTURE — not a model output');

    const list = within(findings()).getByRole('list');
    expect(within(list).getByText('0.71')).toBeInTheDocument();
    expect(within(list).getByText('0.07')).toBeInTheDocument();
    expect(list.querySelector('.finding-state.failed')).toHaveTextContent(
      'Analysis failed — INFERENCE_FAILED',
    );
    expect(within(list).getByText('Not supported by this model')).toBeInTheDocument();
    const rows = container.querySelectorAll('.finding');
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toHaveClass('fixture');
    expect(container.querySelector('.viewer')).toHaveClass('fixture');
  });

  it('shows a live result without fixture stripes or fixture wording', async () => {
    // Test data: a dataset-origin study and a live response (never produced by the app today).
    const datasetStudy: StudyDetail = { ...study, origin: 'dataset' };
    mockApi(
      { 'POST /predictions': () => json(liveResponse()) },
      { [study.study_id]: datasetStudy },
    );
    const { container } = renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run analysis' }));
    await screen.findByText(/^LIVE/);
    expect(container.querySelector('.viewer')).not.toHaveClass('fixture');
    for (const row of container.querySelectorAll('.finding'))
      expect(row).not.toHaveClass('fixture');
    expect(findings()).not.toHaveTextContent(/FIXTURE/);
  });

  it('runs with the r key and re-announces on every run', async () => {
    const { calls } = mockApi({ 'POST /predictions': () => json(fixture) });
    renderReview();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Run analysis' });
    await user.keyboard('r');
    await screen.findByRole('button', { name: 'Run again' });
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Analysis complete.'));
    const before = liveRegion().firstElementChild;
    await user.keyboard('r');
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    await screen.findByRole('button', { name: 'Run again' });
    expect(liveRegion().firstElementChild).not.toBe(before); // a new node, so it is announced again
  });

  it('sends only the study id: no label fields in the request', async () => {
    const { calls } = mockApi({ 'POST /predictions': () => json(fixture) });
    renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run analysis' }));
    await screen.findByText('FIXTURE — not a model output');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.path).toBe('/predictions');
    expect(Object.keys(post?.body as object).sort()).toEqual(['allow_cached', 'study_id']);
  });
});

describe('study-level failure', () => {
  it('HTTP 422 PREPROCESSING_FAILED shows Analysis failed with code and request id, and no scores', async () => {
    mockApi({ 'POST /predictions': () => json(failure.body, failure.status) });
    const { container } = renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Run analysis' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Analysis failed' })).toBeInTheDocument();
    expect(alert).toHaveTextContent('PREPROCESSING_FAILED');
    expect(alert).toHaveTextContent(failure.body.error.request_id);
    expect(liveRegion()).toHaveTextContent('Analysis failed. PREPROCESSING_FAILED.');
    expect(container.querySelector('.finding-score')).toBeNull();
    expect(container.querySelector('.bar')).toBeNull();
    expect(container.querySelector('.prov')).toBeNull();
    expect(findings().textContent).not.toMatch(/\b\d\.\d{2}\b/);
    expect(screen.getByRole('button', { name: 'Run again' })).toBeEnabled();
  });
});
