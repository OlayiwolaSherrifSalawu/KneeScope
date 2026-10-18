import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, PredictionResponse, StudyDetail, StudyLabels } from '../api/types';
import { ReviewPage } from '../pages/ReviewPage';
import { example } from './examples';
import { FakeImage, json, mockApi, stubCanvas } from './mockApi';

const study = example<StudyDetail>('study-detail').body;
const labels = example<StudyLabels>('labels').body;
const prediction = example<PredictionResponse>('prediction-fixture').body;
const notFound = example<ApiError>('error-study-not-found');

// Test data: a second study (same shape as the example) to switch to.
const otherStudy: StudyDetail = {
  ...study,
  study_id: 'fx-study-002',
  display_label: 'Fixture study 002',
};
const studies = { [study.study_id]: study, [otherStudy.study_id]: otherStudy };

const LABELS_PATH = `/studies/${study.study_id}/labels`;

beforeEach(() => {
  FakeImage.srcs = [];
  vi.stubGlobal('Image', FakeImage);
  stubCanvas();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderReview() {
  return render(
    <MemoryRouter initialEntries={[`/studies/${study.study_id}`]}>
      <Link to={`/studies/${otherStudy.study_id}`}>Switch study</Link>
      <Routes>
        <Route path="studies/:studyId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const labelRequests = (calls: { path: string }[]) =>
  calls.filter((c) => c.path.endsWith('/labels'));
const revealButton = (finding: string) =>
  screen.getByRole('button', { name: `Reveal dataset label for ${finding}` });
const rowOf = (finding: string) =>
  screen.getByRole('group', { name: new RegExp(`^${finding},`) }).closest('li') as HTMLElement;

describe('dataset label reveal', () => {
  it('makes no /labels request until the first reveal click, then exactly one', async () => {
    const { calls } = mockApi({ [`GET ${LABELS_PATH}`]: () => json(labels) }, studies);
    renderReview();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Run analysis' });
    expect(screen.queryByText(/Dataset label:/)).not.toBeInTheDocument();
    expect(labelRequests(calls)).toHaveLength(0);

    // Neither viewing the viewer nor navigating slices fetches labels.
    await user.keyboard('jk');
    expect(labelRequests(calls)).toHaveLength(0);

    await user.click(revealButton('ACL'));
    await waitFor(() => expect(within(rowOf('ACL')).getByText(/Dataset label:/)).toBeVisible());
    expect(labelRequests(calls)).toHaveLength(1);

    // Revealing another finding reuses the response.
    await user.click(revealButton('MCL'));
    await within(rowOf('MCL')).findByText(/Dataset label:/);
    expect(labelRequests(calls)).toHaveLength(1);
  });

  it('shows each state with provenance, and never words unknown as Negative', async () => {
    mockApi({ [`GET ${LABELS_PATH}`]: () => json(labels) }, studies);
    renderReview();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Run analysis' });
    for (const name of ['ACL', 'MCL', 'Medial meniscus', 'Lateral meniscus']) {
      await user.click(revealButton(name));
    }
    const text = (name: string) => within(rowOf(name)).getByText(/Dataset label:/).textContent;
    await waitFor(() => expect(text('ACL')).toBe('Dataset label: Positive'));
    expect(text('MCL')).toBe('Dataset label: Negative');
    expect(text('Medial meniscus')).toBe('Dataset label: Unknown (not labelled)');
    expect(text('Lateral meniscus')).toBe('Dataset label: Not labelled');

    // 'unknown' must not read as a negative anywhere in its row.
    expect(rowOf('Medial meniscus').textContent).not.toMatch(/Negative/);
    // ...and 'not_labeled' reads as not labelled, not as a negative or an unknown.
    expect(rowOf('Lateral meniscus').textContent).not.toMatch(/Negative|Unknown/);

    const prov = within(rowOf('ACL')).getByText(/Provenance:/);
    expect(prov).toHaveTextContent(/fixture/i);
    expect(prov).toHaveTextContent('contracts/fixtures/labels.json');
    expect(screen.getByText(labels.notice)).toBeInTheDocument();
  });

  it('hides revealed labels when the study changes and fetches again only on a new reveal', async () => {
    const { calls } = mockApi(
      {
        [`GET ${LABELS_PATH}`]: () => json(labels),
        [`GET /studies/${otherStudy.study_id}/labels`]: () =>
          json({ ...labels, study_id: otherStudy.study_id }),
      },
      studies,
    );
    renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reveal dataset label for ACL' }));
    await screen.findByText('Dataset label: Positive');
    expect(labelRequests(calls)).toHaveLength(1);

    await user.click(screen.getByRole('link', { name: 'Switch study' }));
    await screen.findByText('Fixture study 002');
    expect(screen.queryByText(/Dataset label:/)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.notice)).not.toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: /dataset label for/ })) {
      expect(b).toHaveAccessibleName(/^Reveal /);
      expect(b).toHaveAttribute('aria-expanded', 'false');
    }
    expect(labelRequests(calls)).toHaveLength(1); // no request for the new study yet

    await user.click(screen.getByRole('button', { name: 'Reveal dataset label for MCL' }));
    await screen.findByText('Dataset label: Negative');
    expect(labelRequests(calls).map((c) => c.path)).toEqual([
      LABELS_PATH,
      `/studies/${otherStudy.study_id}/labels`,
    ]);
  });

  it('can be hidden again without another request', async () => {
    const { calls } = mockApi({ [`GET ${LABELS_PATH}`]: () => json(labels) }, studies);
    renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reveal dataset label for ACL' }));
    await screen.findByText('Dataset label: Positive');
    await user.click(screen.getByRole('button', { name: 'Hide dataset label for ACL' }));
    expect(screen.queryByText(/Dataset label:/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal dataset label for ACL' }));
    await screen.findByText('Dataset label: Positive');
    expect(labelRequests(calls)).toHaveLength(1);
  });

  it('shows the error code when labels cannot be loaded and retries on request', async () => {
    let attempts = 0;
    mockApi(
      {
        [`GET ${LABELS_PATH}`]: () =>
          ++attempts === 1 ? json(notFound.body, notFound.status) : json(labels),
      },
      studies,
    );
    renderReview();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reveal dataset label for ACL' }));
    const alert = await within(rowOf('ACL')).findByRole('alert');
    expect(alert).toHaveTextContent(`Dataset label unavailable — ${notFound.body.error.code}`);
    expect(rowOf('ACL').textContent).not.toMatch(/Positive|Negative/);
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByText('Dataset label: Positive');
  });
});

describe('labels stay out of inference', () => {
  it('the predictions request body never contains label fields, whether run before or after reveal', async () => {
    const { calls } = mockApi(
      {
        [`GET ${LABELS_PATH}`]: () => json(labels),
        'POST /predictions': () => json(prediction),
      },
      studies,
    );
    renderReview();
    const user = userEvent.setup();
    const run = await screen.findByRole('button', { name: 'Run analysis' });
    await user.click(run);
    await screen.findByText('FIXTURE — not a model output');

    await user.click(revealButton('ACL'));
    await screen.findByText('Dataset label: Positive');
    await user.click(screen.getByRole('button', { name: 'Run again' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));

    for (const post of calls.filter((c) => c.method === 'POST')) {
      expect(Object.keys(post.body as object).sort()).toEqual(['allow_cached', 'study_id']);
      const raw = JSON.stringify(post.body);
      expect(raw).not.toMatch(/label|provenance|positive|negative|unknown|not_labeled/i);
    }
    // The score rows are unchanged by revealing a label.
    expect(within(rowOf('ACL')).getByText('0.71')).toBeInTheDocument();
  });
});
