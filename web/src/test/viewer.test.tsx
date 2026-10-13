import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, StudyDetail } from '../api/types';
import { ViewerPanel } from '../components/viewer/ViewerPanel';
import { example } from './examples';

const study = example<StudyDetail>('study-detail').body;
const errorBody = example<ApiError>('error-study-not-found').body;

/** Test double for Image: records every requested src and settles asynchronously. */
class FakeImage {
  static srcs: string[] = [];
  static failing: (url: string) => boolean = () => false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    FakeImage.srcs.push(url);
    queueMicrotask(() => (FakeImage.failing(url) ? this.onerror?.() : this.onload?.()));
  }
}

const sliceRequests = () =>
  FakeImage.srcs
    .map((u) => Number(u.match(/\/slices\/(\d+)/)?.[1]))
    .filter((n) => !Number.isNaN(n));

/** The example study without an axial series (test data derived from the contract example). */
const noAxial: StudyDetail = {
  ...study,
  series: study.series.filter((s) => s.plane !== 'axial'),
  series_count: 3,
  planes_available: ['sagittal', 'coronal'],
  missing_planes: ['axial'],
};

beforeEach(() => {
  FakeImage.srcs = [];
  FakeImage.failing = () => false;
  vi.stubGlobal('Image', FakeImage);
  // jsdom has no canvas implementation; a stub 2D context is enough to observe drawing.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const controls = () => screen.getByRole('group', { name: 'Slice controls' });
const canvas = () => screen.getByRole('img', { hidden: true });
const readout = () => within(controls()).getByTestId('slice-readout');

describe('slice navigation', () => {
  it('j moves from slice 1 to 2 of 30 and requests 0-based slice_index 1; End shows 30 / 30', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    // Opens on the middle slice of the first series (index 14 of 30).
    expect(readout()).toHaveTextContent('15 / 30');

    await user.keyboard('{Home}');
    expect(readout()).toHaveTextContent('1 / 30');
    await user.keyboard('j');
    expect(readout()).toHaveTextContent('2 / 30');
    await waitFor(() => expect(FakeImage.srcs.some((u) => u.endsWith('/slices/1'))).toBe(true));
    expect(canvas()).toHaveAccessibleName(/slice 2 of 30/);

    await user.keyboard('{End}');
    expect(readout()).toHaveTextContent('30 / 30');
    await waitFor(() => expect(FakeImage.srcs.some((u) => u.endsWith('/slices/29'))).toBe(true));
  });

  it('supports k, arrows, PageUp/PageDown +-10, and clamps at the ends', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    await user.keyboard('{Home}');
    await user.keyboard('k');
    expect(readout()).toHaveTextContent('1 / 30');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(readout()).toHaveTextContent('2 / 30');
    await user.keyboard('{PageDown}');
    expect(readout()).toHaveTextContent('12 / 30');
    await user.keyboard('{PageUp}{PageUp}');
    expect(readout()).toHaveTextContent('1 / 30');
    await user.keyboard('{End}{PageDown}');
    expect(readout()).toHaveTextContent('30 / 30');
  });

  it('first/previous/next/last buttons and the slider drive the same slice', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    await user.click(screen.getByRole('button', { name: 'First slice' }));
    expect(readout()).toHaveTextContent('1 / 30');
    await user.click(screen.getByRole('button', { name: 'Next slice' }));
    expect(readout()).toHaveTextContent('2 / 30');
    await user.click(screen.getByRole('button', { name: 'Last slice' }));
    expect(readout()).toHaveTextContent('30 / 30');
    await user.click(screen.getByRole('button', { name: 'Previous slice' }));
    expect(readout()).toHaveTextContent('29 / 30');
    const slider = screen.getByRole('slider', { name: 'Slice' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Slice 29 of 30');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(readout()).toHaveTextContent('5 / 30');
    expect(slider).toHaveAttribute('aria-valuetext', 'Slice 5 of 30');
  });

  it('prefetches two slices either side of the displayed one', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    await user.keyboard('{Home}');
    await waitFor(() => {
      const wanted = [0, 1, 2];
      expect(wanted.every((i) => sliceRequests().includes(i))).toBe(true);
    });
    // At the first slice there is nothing behind it, and nothing beyond +2 is fetched.
    expect(sliceRequests()).not.toContain(3);
    expect(sliceRequests()).not.toContain(-1);
    await user.keyboard('{PageDown}'); // slice index 10
    await waitFor(() => {
      for (const i of [8, 9, 10, 11, 12]) expect(sliceRequests()).toContain(i);
    });
  });
});

describe('plane tabs and series', () => {
  it('missing plane is aria-disabled and skipped by arrow keys and the 3 shortcut', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={noAxial} fixtureStripe />);
    const axial = screen.getByRole('tab', { name: /Axial/ });
    expect(axial).toHaveAttribute('aria-disabled', 'true');
    expect(axial).toHaveTextContent('Axial — not available');
    expect(axial).toHaveAccessibleDescription('Axial series not available for this study');
    expect(axial).toHaveAttribute('tabindex', '-1');

    const coronal = screen.getByRole('tab', { name: /^Coronal/ });
    const sagittal = screen.getByRole('tab', { name: /^Sagittal/ });
    await user.click(coronal);
    expect(coronal).toHaveAttribute('aria-selected', 'true');
    coronal.focus();
    await user.keyboard('{ArrowRight}'); // would land on Axial; wraps to Sagittal instead
    expect(sagittal).toHaveAttribute('aria-selected', 'true');
    expect(sagittal).toHaveFocus();
    expect(axial).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('2');
    expect(coronal).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('3');
    expect(axial).toHaveAttribute('aria-selected', 'false');
    expect(coronal).toHaveAttribute('aria-selected', 'true');
    await user.click(axial);
    expect(coronal).toHaveAttribute('aria-selected', 'true');
  });

  it('uses roving tabindex: only the selected tab is a tab stop', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    await user.keyboard('3');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });

  it('switching plane resets to that series middle slice and does not link planes', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    await user.keyboard('{End}');
    expect(readout()).toHaveTextContent('30 / 30');
    await user.keyboard('2');
    expect(readout()).toHaveTextContent('14 / 28'); // middle of the 28-slice coronal series
    await user.keyboard('3');
    expect(readout()).toHaveTextContent('16 / 32');
    expect(screen.queryByText(/crosshair|linked|synchron/i)).not.toBeInTheDocument();
  });

  it('series select switches series and resets to its middle slice', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const select = screen.getByRole('combobox', { name: /Series/ });
    await user.selectOptions(select, 'fx-ser-04');
    expect(readout()).toHaveTextContent('12 / 24');
    expect(canvas()).toHaveAccessibleName(/Sag T1/);
  });
});

describe('keyboard shortcut guard', () => {
  it('does not fire while the series select or a slider has focus', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const before = readout().textContent;
    screen.getByRole('combobox', { name: /Series/ }).focus();
    await user.keyboard('jjj{End}2');
    expect(readout().textContent).toBe(before);
    expect(screen.getByRole('tab', { name: /^Sagittal/ })).toHaveAttribute('aria-selected', 'true');

    screen.getByRole('slider', { name: 'Slice' }).focus();
    await user.keyboard('k+');
    expect(canvas()).toHaveAttribute('data-zoom', '1');
  });

  it('opens the shortcut sheet with ?, keeps page shortcuts quiet inside, and closes with Esc', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(dialog).getByText('Run analysis (when enabled)')).toBeInTheDocument();
    const before = readout().textContent;
    await user.keyboard('j{End}');
    expect(readout().textContent).toBe(before);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('j');
    expect(readout().textContent).not.toBe(before);
  });
});

describe('canvas and display', () => {
  it('names the canvas with study, series, plane and slice', async () => {
    render(<ViewerPanel study={study} fixtureStripe />);
    const el = await screen.findByRole('img'); // visible once the first slice has loaded
    expect(el).toHaveAccessibleName(/fx-study-001/);
    expect(el).toHaveAccessibleName(/Sag PD FS \(fixture\)/);
    expect(el).toHaveAccessibleName(/sagittal plane/);
    expect(el).toHaveAccessibleName(/slice 15 of 30/);
  });

  it('labels the display adjust control as not window/level and applies a CSS filter', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const trigger = screen.getByRole('button', { name: /not window\/level/i });
    expect(trigger).toHaveAccessibleName(/Display adjust/);
    expect(canvas().style.filter).toBe('');
    await user.click(trigger);
    const brightness = screen.getByRole('slider', { name: /Brightness/ });
    fireEvent.change(brightness, { target: { value: '150' } });
    expect(canvas().style.filter).toContain('brightness(150%)');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(canvas().style.filter).toBe('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('shows corner annotations with 1-based slice and no motion between slices', () => {
    const { container } = render(<ViewerPanel study={study} fixtureStripe />);
    const well = screen.getByTestId('viewer-well');
    expect(within(well).getByText('Rendered slice (PNG)')).toBeInTheDocument();
    expect(container.querySelector('.corner.bl')).toHaveTextContent('15 / 30');
    expect(container.querySelector('.corner.bl')).toHaveTextContent('sagittal');
    expect(canvas().style.transition).toBe('');
  });

  it('zooms with + - 0, switching to nearest-neighbour only above 200%', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const el = canvas();
    const corner = () => document.querySelector('.corner.br')?.textContent;
    expect(el).toHaveAttribute('data-rendering', 'smooth');
    expect(corner()).toBe('100% (fit)');
    await user.keyboard('+'); // 150%
    await user.keyboard('+'); // 200% is not above 200%
    expect(corner()).toBe('200%');
    expect(el).toHaveAttribute('data-rendering', 'smooth');
    await user.keyboard('+'); // 300%
    expect(corner()).toBe('300%');
    expect(el).toHaveAttribute('data-rendering', 'nearest-neighbour');
    await user.keyboard('-');
    expect(el).toHaveAttribute('data-rendering', 'smooth');
    await user.keyboard('++0');
    expect(corner()).toBe('100% (fit)');
    expect(el.style.transform).toContain('scale(1)');
  });

  it('pans by dragging when zoomed and resets on fit', async () => {
    const user = userEvent.setup();
    render(<ViewerPanel study={study} fixtureStripe />);
    const well = screen.getByTestId('viewer-well');
    const el = canvas();
    await user.keyboard('+++');
    fireEvent.pointerDown(well, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(well, { pointerId: 1, clientX: 130, clientY: 90 });
    fireEvent.pointerUp(well, { pointerId: 1, clientX: 130, clientY: 90 });
    expect(el.style.transform).toContain('translate(30px, -10px)');
    await user.click(screen.getByRole('button', { name: 'Fit to window' }));
    expect(el.style.transform).toContain('translate(0px, 0px)');
  });
});

describe('load errors', () => {
  it('shows the API error code in the well and retries on request', async () => {
    const user = userEvent.setup();
    FakeImage.failing = (u) => u.endsWith('/slices/14');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ViewerPanel study={study} fixtureStripe />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Slice image could not be loaded.');
    expect(alert).toHaveTextContent(errorBody.error.code);
    expect(canvas().style.visibility).toBe('hidden');

    FakeImage.failing = () => false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(canvas().style.visibility).toBe('visible');
  });
});
