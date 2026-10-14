import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Explanation, PredictionResponse, StudyDetail } from '../api/types';
import { attentionRgba, checkOverlay } from '../components/explanations/alignment';
import panelSource from '../components/explanations/ExplanationPanel.tsx?raw';
import { ReviewPage } from '../pages/ReviewPage';
import { example } from './examples';
import { FakeImage, json, mockApi, stubCanvas } from './mockApi';

const study = example<StudyDetail>('study-detail').body;
const prediction = example<PredictionResponse>('prediction-fixture').body;
const explanation = example<Explanation>('explanation-available').body;
const unavailable = example<Explanation>('explanation-unavailable').body;
const PID = prediction.prediction_id;
const ACL_PATH = `/studies/${study.study_id}/explanations/acl?prediction_id=${PID}`;

// Test data only: an attention map for slice_index 12 of fx-ser-01 (a 1x1 gray PNG is enough
// because jsdom cannot decode images; drawing is exercised by the alignment logic).
const withMap: Explanation = {
  ...explanation,
  kind: 'attention_map',
  attention: [
    {
      slice_index: 12,
      width: 256,
      height: 256,
      encoding: 'png_base64_gray8',
      data: 'iVBORw0KGgo=',
    },
  ],
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

function setup(acl: Explanation = explanation) {
  const api = mockApi({
    'POST /predictions': () => json(prediction),
    [`GET ${ACL_PATH}`]: () => json(acl),
  });
  render(
    <MemoryRouter initialEntries={[`/studies/${study.study_id}`]}>
      <Routes>
        <Route path="studies/:studyId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return api;
}

async function runAnalysis(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /run analysis/i }));
  return screen.findByRole('region', { name: 'ACL explanation' });
}

describe('Explanation panel (KS-WEB-05)', () => {
  it('jumps to the influential slice on the referenced series', async () => {
    const user = userEvent.setup();
    setup();
    const panel = await runAnalysis(user);
    // Move the viewer away first: another sagittal series.
    await user.selectOptions(screen.getByRole('combobox'), 'fx-ser-04');
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Sag T1/);

    await user.click(within(panel).getByRole('listitem', { name: /Sagittal slice 13/ }));
    const canvas = screen.getByRole('img');
    expect(canvas.getAttribute('aria-label')).toMatch(/Sag PD FS/);
    expect(canvas.getAttribute('aria-label')).toMatch(/slice 13 of 30/);
  });

  it('names it influential slices and keeps the localisation caveat', async () => {
    const user = userEvent.setup();
    setup();
    const panel = await runAnalysis(user);
    expect(within(panel).getByText(/ACL · Influential slices/)).toBeTruthy();
    expect(within(panel).getByText(/does not localise an injury/)).toBeTruthy();
  });

  it('shows Explanation unavailable without requesting one when none exists', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await runAnalysis(user);
    await user.click(screen.getByRole('button', { name: 'Select MCL' }));
    const panel = screen.getByRole('region', { name: 'MCL explanation' });
    expect(within(panel).getByText('Explanation unavailable')).toBeTruthy();
    expect(within(panel).getByText('No explanation was produced for this finding.')).toBeTruthy();
    expect(calls.some((c) => c.path.includes('/explanations/mcl'))).toBe(false);
  });

  it('shows the API reason for an unavailable explanation', async () => {
    const user = userEvent.setup();
    setup({ ...unavailable, finding_id: 'acl' });
    const panel = await runAnalysis(user);
    await waitFor(() => expect(within(panel).getByText('Explanation unavailable')).toBeTruthy());
    expect(within(panel).getByText(unavailable.reason?.message ?? '')).toBeTruthy();
  });

  it('moves the selected finding with [ and ]', async () => {
    const user = userEvent.setup();
    setup();
    await runAnalysis(user);
    await user.keyboard(']');
    expect(screen.getByRole('region', { name: 'MCL explanation' })).toBeTruthy();
    await user.keyboard('[[');
    expect(screen.getByRole('region', { name: 'ACL explanation' })).toBeTruthy();
  });

  it('does not draw a misaligned overlay and says why', async () => {
    const user = userEvent.setup();
    setup(withMap);
    const panel = await runAnalysis(user);
    await user.selectOptions(screen.getByRole('combobox'), 'fx-ser-04');
    await user.click(within(panel).getByRole('checkbox', { name: /attention overlay/ }));
    expect(
      within(panel).getByText(/Alignment check failed: Overlay was computed for series fx-ser-01/),
    ).toBeTruthy();
    expect(screen.queryByTestId('attention-overlay')).toBeNull();
    expect(within(panel).getByText('Model attention (relative, not lesion location)')).toBeTruthy();
  });

  it('draws the overlay once series and slice match', async () => {
    const user = userEvent.setup();
    setup(withMap);
    const panel = await runAnalysis(user);
    await user.click(within(panel).getByRole('checkbox', { name: /attention overlay/ }));
    await user.click(within(panel).getByRole('listitem', { name: /Sagittal slice 13/ })); // index 12
    const overlay = await screen.findByTestId('attention-overlay');
    expect(overlay.getAttribute('data-slice-index')).toBe('12');
    expect(within(panel).queryByText(/Alignment check failed/)).toBeNull();
  });
});

describe('alignment rules', () => {
  const position = {
    seriesId: 'fx-ser-01',
    sliceIndex: 12,
    renderedWidth: 256,
    renderedHeight: 256,
  };
  const shown = { predictionId: PID, modelVersion: 'fixture-0' };

  it('accepts only an exact match', () => {
    expect(checkOverlay(withMap, position, shown).ok).toBe(true);
    expect(checkOverlay(withMap, { ...position, sliceIndex: 13 }, shown).ok).toBe(false);
    expect(checkOverlay(withMap, { ...position, renderedWidth: 512 }, shown).ok).toBe(false);
    expect(checkOverlay(withMap, position, { ...shown, predictionId: 'other' }).ok).toBe(false);
    expect(checkOverlay(withMap, position, { ...shown, modelVersion: 'other' }).ok).toBe(false);
  });

  it('uses a single-hue ochre to rust ramp, never blue', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = attentionRgba(v, 1);
      expect(r).toBeGreaterThan(b);
      expect(r).toBeGreaterThan(g);
    }
    expect(attentionRgba(0, 1)[3]).toBe(0);
  });

  it('never uses lesion-localisation wording except the negated legend', () => {
    const lowered = panelSource.toLowerCase();
    expect(lowered).not.toMatch(/tear detected|detected here|lesion at/);
    expect(lowered.match(/lesion location/g)?.length).toBe(1);
    expect(panelSource).toContain('not lesion location');
  });
});
