import { Clock } from 'lucide-react';
import { PLANES, type Plane, type StudySummary } from '../api/types';
import { HatchBlock, StateGlyph } from './StateGlyph';

const PLANE_LETTER: Record<Plane, string> = { sagittal: 'S', coronal: 'C', axial: 'A' };
const PLANE_LABEL: Record<Plane, string> = {
  sagittal: 'Sagittal',
  coronal: 'Coronal',
  axial: 'Axial',
};
const STATUS_LABEL: Record<StudySummary['analysis_status'], string> = {
  not_run: 'Not run',
  cached: 'Cached',
  failed: 'Failed',
};

/** Three fixed slots S·C·A. A missing plane is an em dash whose text reads "<Plane> missing". */
export function PlaneSlots({ study }: { study: StudySummary }) {
  return (
    <span className="planes">
      {PLANES.map((p) =>
        study.planes_available.includes(p) ? (
          <span key={p} className="plane-slot">
            <span aria-hidden="true">{PLANE_LETTER[p]}</span>
            <span className="sr-only">{PLANE_LABEL[p]}</span>
          </span>
        ) : (
          <span key={p} className="plane-slot missing">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{PLANE_LABEL[p]} missing</span>
          </span>
        ),
      )}
    </span>
  );
}

export function AnalysisStatus({ status }: { status: StudySummary['analysis_status'] }) {
  switch (status) {
    case 'not_run':
      return (
        <span className="status">
          <StateGlyph status="not_evaluated" />
          {STATUS_LABEL[status]}
        </span>
      );
    case 'cached':
      return (
        <span className="status cached">
          <Clock className="i" aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      );
    case 'failed':
      return (
        <span className="status failed">
          <StateGlyph status="failed" />
          {STATUS_LABEL[status]}
        </span>
      );
  }
}

export function OriginBadge({ origin }: { origin: StudySummary['origin'] }) {
  return origin === 'fixture' ? (
    <span className="origin">
      <HatchBlock />
      FIXTURE
    </span>
  ) : (
    <span className="origin">Dataset</span>
  );
}

/** Accessible name of the row link: ID, label, plane availability and analysis status. */
export function studyAccessibleName(s: StudySummary): string {
  const planes = PLANES.map((p) =>
    s.planes_available.includes(p) ? PLANE_LABEL[p] : `${PLANE_LABEL[p]} missing`,
  ).join(', ');
  return `${s.study_id}, ${s.display_label}, planes: ${planes}, analysis: ${STATUS_LABEL[s.analysis_status]}`;
}
