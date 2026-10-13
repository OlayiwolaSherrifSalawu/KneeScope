import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError, API_UNREACHABLE } from '../api/client';
import type { StudyList } from '../api/types';
import { StudiesPage } from '../pages/StudiesPage';
import { example } from './examples';

const studies = example<StudyList>('studies').body;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route index element={<StudiesPage />} />
        <Route path="studies/:studyId" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('StudiesPage states', () => {
  it('shows a busy region and loading text while the request is pending', () => {
    vi.spyOn(api, 'studies').mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(screen.getByText('Loading studies…')).toBeInTheDocument();
    expect(container.querySelector('.table-wrap')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
  });

  it('shows the empty message when no studies are permitted', async () => {
    vi.spyOn(api, 'studies').mockResolvedValue({ ...studies, studies: [] });
    renderPage();
    expect(await screen.findByText('No permitted studies')).toBeInTheDocument();
    expect(screen.getByText(/Add studies with/)).toBeInTheDocument();
    expect(screen.getByText('scripts/build_manifest.py')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows code, request id and Retry for a retryable error, and Retry reloads', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'studies');
    spy.mockRejectedValueOnce(
      new ApiRequestError({
        code: 'UPSTREAM_TIMEOUT',
        message: 'The service timed out.',
        requestId: 'req-123',
        retryable: true,
        status: 503,
      }),
    );
    spy.mockResolvedValueOnce(studies);
    renderPage();
    expect(await screen.findByText('Studies could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('UPSTREAM_TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText(/request req-123/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Fixture study 001');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('offers Retry for API_UNREACHABLE even when not marked retryable', async () => {
    vi.spyOn(api, 'studies').mockRejectedValue(
      new ApiRequestError({ code: API_UNREACHABLE, message: 'Cannot reach the API.' }),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('omits Retry when the error is not retryable', async () => {
    vi.spyOn(api, 'studies').mockRejectedValue(
      new ApiRequestError({
        code: 'STUDY_NOT_FOUND',
        message: 'No such study.',
        requestId: 'req-9',
        retryable: false,
      }),
    );
    renderPage();
    expect(await screen.findByText('STUDY_NOT_FOUND')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('renders each study with its fields when populated', async () => {
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    await screen.findByText('Fixture study 001');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(studies.studies.length + 1);
    expect(screen.getByText('fx-study-001')).toBeInTheDocument();
    expect(screen.getAllByText('FIXTURE').length).toBeGreaterThan(0);
    expect(screen.getByText(studies.origin_notice ?? '')).toBeInTheDocument();
  });
});

describe('StudiesPage rows', () => {
  it('marks a missing plane with "<Plane> missing" text', async () => {
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    const row = (await screen.findByText('Fixture study 002 (axial missing)')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Axial missing')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('Sagittal missing')).toBeNull();
  });

  it('names each row link with plane availability and analysis status', async () => {
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    expect(
      await screen.findByRole('link', {
        name: 'fx-study-002, Fixture study 002 (axial missing), planes: Sagittal, Coronal, Axial missing, analysis: Not run',
      }),
    ).toHaveAttribute('href', '/studies/fx-study-002');
    expect(screen.getByRole('link', { name: /^fx-study-003,.*analysis: Failed$/ })).toBeVisible();
  });

  it('opens /studies/:id with Tab then Enter', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    const link = await screen.findByRole('link', { name: /^fx-study-001,/ });
    for (let i = 0; i < 10 && document.activeElement !== link; i++) await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('where')).toHaveTextContent('/studies/fx-study-001');
  });

  it('opens the study when the row is clicked outside the link', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    const row = (await screen.findByText('Fixture study 001')).closest('tr') as HTMLElement;
    await user.click(within(row).getByText('Not run'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/studies/fx-study-001');
  });
});

describe('StudiesPage filter and sort', () => {
  const ids = () =>
    screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h) => h?.startsWith('/studies/'));

  it('filters by study ID and recovers via Clear filter', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    await screen.findByText('Fixture study 001');
    await user.type(screen.getByRole('searchbox', { name: 'Filter by study ID' }), 'STUDY-002');
    expect(ids()).toEqual(['/studies/fx-study-002']);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No studies match the filter')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(ids().length).toBe(studies.studies.length);
  });

  it('sorts by study ID ascending and reverses on request', async () => {
    const user = userEvent.setup();
    const reversed = { ...studies, studies: [...studies.studies].reverse() };
    vi.spyOn(api, 'studies').mockResolvedValue(reversed);
    renderPage();
    await screen.findByText('Fixture study 001');
    const asc = [...studies.studies.map((s) => `/studies/${s.study_id}`)].sort();
    expect(ids()).toEqual(asc);
    expect(screen.getByRole('columnheader', { name: 'Study' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: /Sort by study ID, ascending/ }));
    expect(ids()).toEqual([...asc].reverse());
    expect(screen.getByRole('columnheader', { name: 'Study' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('StudiesPage below 600px', () => {
  it('renders a card list with the same links instead of the table', async () => {
    mockMatchMedia(true);
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    const list = await screen.findByRole('list', { name: 'Studies available for review' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(within(list).getAllByRole('listitem')).toHaveLength(studies.studies.length);
    expect(
      screen.getByRole('link', { name: /^fx-study-002,.*Axial missing, analysis: Not run$/ }),
    ).toHaveAttribute('href', '/studies/fx-study-002');
  });

  it('renders the table at 600px and wider', async () => {
    mockMatchMedia(false);
    vi.spyOn(api, 'studies').mockResolvedValue(studies);
    renderPage();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryByRole('list', { name: 'Studies available for review' })).toBeNull();
  });
});
