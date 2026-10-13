import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '../api/client';
import type { StudyList, StudySummary } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import {
  AnalysisStatus,
  OriginBadge,
  PlaneSlots,
  studyAccessibleName,
} from '../components/StudyParts';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';

const STUDY_PATH = (id: string) => `/studies/${encodeURIComponent(id)}`;

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <td key={c}>
              <div className="skel" style={{ width: c === 0 ? '70%' : '50%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <ul className="study-cards" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="study-card">
          <div className="skel" style={{ width: '60%' }} />
          <div className="skel" style={{ width: '40%' }} />
        </li>
      ))}
    </ul>
  );
}

function StudyCards({ rows }: { rows: StudySummary[] }) {
  return (
    <ul className="study-cards" aria-label="Studies available for review">
      {rows.map((s) => (
        <li key={s.study_id} className="study-card">
          <Link
            to={STUDY_PATH(s.study_id)}
            className="study-card-link"
            aria-label={studyAccessibleName(s)}
          >
            <span className="study-id">{s.study_id}</span>
            <span className="muted">{s.display_label}</span>
          </Link>
          <dl className="study-card-fields" aria-hidden="true">
            <div>
              <dt>Origin</dt>
              <dd>
                <OriginBadge origin={s.origin} />
              </dd>
            </div>
            <div>
              <dt>Planes</dt>
              <dd>
                <PlaneSlots study={s} />
              </dd>
            </div>
            <div>
              <dt>Series</dt>
              <dd className="mono">{s.series_count}</dd>
            </div>
            <div>
              <dt>Analysis</dt>
              <dd>
                <AnalysisStatus status={s.analysis_status} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function StudyTable({
  rows,
  loading,
  descending,
}: {
  rows: StudySummary[];
  loading: boolean;
  descending: boolean;
}) {
  const navigate = useNavigate();
  return (
    <table className="studies">
      <caption className="sr-only">Studies available for review</caption>
      <thead>
        <tr>
          <th scope="col" aria-sort={descending ? 'descending' : 'ascending'}>
            Study
          </th>
          <th scope="col">Origin</th>
          <th scope="col">Planes</th>
          <th scope="col" className="num">
            Series
          </th>
          <th scope="col">Analysis</th>
          <th scope="col">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <SkeletonRows />
        ) : (
          rows.map((s) => (
            // The study link is the keyboard target; clicking anywhere else in the row follows it.
            <tr
              key={s.study_id}
              className="row-link"
              onClick={(e) => {
                if (!(e.target instanceof Element && e.target.closest('a'))) {
                  void navigate(STUDY_PATH(s.study_id));
                }
              }}
            >
              <td>
                <Link to={STUDY_PATH(s.study_id)} aria-label={studyAccessibleName(s)}>
                  <span className="study-id">{s.study_id}</span>
                </Link>{' '}
                <span className="muted">{s.display_label}</span>
              </td>
              <td>
                <OriginBadge origin={s.origin} />
              </td>
              <td>
                <PlaneSlots study={s} />
              </td>
              <td className="num mono">{s.series_count}</td>
              <td>
                <AnalysisStatus status={s.analysis_status} />
              </td>
              <td aria-hidden="true" className="open-cell">
                Open
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function StudiesPage() {
  const studies = useAsync<StudyList>('studies', (signal) => api.studies({ signal }));
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);
  const narrow = useMediaQuery('(max-width: 599px)');
  const loading = studies.phase === 'loading';
  const list = studies.phase === 'ready' ? studies.data : undefined;
  const needle = query.trim().toLowerCase();
  const rows = (list?.studies ?? [])
    .filter((s) => s.study_id.toLowerCase().includes(needle))
    .sort((a, b) => (descending ? -1 : 1) * a.study_id.localeCompare(b.study_id));
  const SortIcon = descending ? ArrowDown : ArrowUp;

  let body;
  if (studies.phase === 'error') {
    body = (
      <ErrorPanel
        error={studies.error}
        title="Studies could not be loaded"
        onRetry={studies.reload}
      />
    );
  } else if (loading) {
    body = (
      <>
        <p className="msg muted" role="status">
          Loading studies…
        </p>
        {narrow ? <SkeletonCards /> : <StudyTable rows={[]} loading descending={descending} />}
      </>
    );
  } else if (list && list.studies.length === 0) {
    body = (
      <div className="msg">
        <span />
        <div>
          <h2>No permitted studies</h2>
          <p>
            No permitted studies in the manifest. Add studies with{' '}
            <code>scripts/build_manifest.py</code>.
          </p>
        </div>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="msg">
        <span />
        <div>
          <h2>No studies match the filter</h2>
          <p>No study ID contains “{query.trim()}”.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setQuery('')}>
              Clear filter
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    body = narrow ? (
      <StudyCards rows={rows} />
    ) : (
      <StudyTable rows={rows} loading={false} descending={descending} />
    );
  }

  return (
    <div className="browser">
      <div className="page-head">
        <div>
          <h1>Studies</h1>
          <p>Choose a study to review. Only the metadata needed for review is shown.</p>
        </div>
        <div className="page-tools">
          <label>
            <span className="sr-only">Filter by study ID</span>
            <input
              className="field"
              type="search"
              placeholder="Filter by study ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn"
            aria-label={`Sort by study ID, ${descending ? 'descending' : 'ascending'}. Activate to reverse.`}
            onClick={() => setDescending((d) => !d)}
          >
            <SortIcon className="i" aria-hidden="true" />
            ID
          </button>
        </div>
      </div>

      <div className="table-wrap" aria-busy={loading}>
        {body}
      </div>
      {list?.origin_notice ? <p className="table-note">{list.origin_notice}</p> : null}
    </div>
  );
}
