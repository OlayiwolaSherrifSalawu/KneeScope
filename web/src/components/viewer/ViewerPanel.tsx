import { useEffect, useMemo, useState } from 'react';
import { PLANES, type Plane, type StudyDetail } from '../../api/types';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { NEUTRAL_ADJUST, type Adjust } from './DisplayAdjust';
import { PlaneTabs } from './PlaneTabs';
import { ShortcutSheet } from './ShortcutSheet';
import type { ViewerPosition } from '../explanations/alignment';
import { SliceCanvas, type OverlayLayer, type Pan } from './SliceCanvas';
import { SliceControls } from './SliceControls';
import { SliceImageCache, neighbourIndices } from './sliceImageCache';
import { sliceUrl } from '../../api/client';

/** Zoom multipliers relative to the fitted image. */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4, 6, 8] as const;

const middle = (n: number) => Math.floor((n - 1) / 2);

/** A request to show a specific series and slice; `nonce` makes repeated jumps distinct. */
export type JumpRequest = { seriesId: string; plane: Plane; sliceIndex: number; nonce: number };
const PAGE = 10;

/**
 * Plane tabs, series select, slice viewer and controls (DESIGN.md sections 9.4, 9.5, 12, 14).
 * Planes are independent acquisitions: nothing here links or synchronises them, and switching
 * plane resets to that series' middle slice.
 */
export function ViewerPanel({
  study,
  fixtureStripe,
  jump = null,
  overlay = null,
  onPosition,
}: {
  study: StudyDetail;
  fixtureStripe: boolean;
  /** Jump from the explanation panel (influential slice chips). */
  jump?: JumpRequest | null;
  /** Aligned attention map to draw over the displayed slice. */
  overlay?: OverlayLayer | null;
  /** Reports the displayed series and slice (for overlay alignment checks). */
  onPosition?: (position: ViewerPosition | null) => void;
}) {
  const available = useMemo(
    () => PLANES.filter((p) => study.planes_available.includes(p)),
    [study.planes_available],
  );
  const seriesCount = useMemo(
    () =>
      Object.fromEntries(
        PLANES.map((p) => [p, study.series.filter((s) => s.plane === p).length]),
      ) as Record<Plane, number>,
    [study.series],
  );
  const initial = study.series.find((s) => s.plane === available[0]) ?? null;

  const [plane, setPlane] = useState<Plane | null>(available[0] ?? null);
  const [seriesId, setSeriesId] = useState<string | null>(initial?.series_id ?? null);
  const [slice, setSlice] = useState(initial ? middle(initial.num_slices) : 0);
  const [zoomStep, setZoomStep] = useState(0);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL_ADJUST);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cache] = useState(() => new SliceImageCache());

  const seriesForPlane = useMemo(
    () => (plane ? study.series.filter((s) => s.plane === plane) : []),
    [study.series, plane],
  );
  const series = seriesForPlane.find((s) => s.series_id === seriesId) ?? seriesForPlane[0] ?? null;
  const count = series?.num_slices ?? 0;
  const zoom = ZOOM_STEPS[zoomStep] ?? 1;

  // Apply a jump request once per nonce.
  const [appliedJump, setAppliedJump] = useState<number | null>(null);
  if (jump && jump.nonce !== appliedJump) {
    const target = study.series.find((s) => s.series_id === jump.seriesId);
    setAppliedJump(jump.nonce);
    if (target && available.includes(jump.plane)) {
      setPlane(jump.plane);
      setSeriesId(target.series_id);
      setSlice(Math.min(Math.max(jump.sliceIndex, 0), target.num_slices - 1));
      setZoomStep(0);
      setPan({ x: 0, y: 0 });
    }
  }

  useEffect(() => {
    onPosition?.(
      series
        ? {
            seriesId: series.series_id,
            sliceIndex: slice,
            renderedWidth: series.rendered_width,
            renderedHeight: series.rendered_height,
          }
        : null,
    );
  }, [onPosition, series, slice]);

  // Warm the slices around the displayed one (prefetch ±2).
  useEffect(() => {
    if (!series) return;
    cache.prefetch(
      neighbourIndices(slice, series.num_slices).map((i) =>
        sliceUrl(study.study_id, series.series_id, i),
      ),
    );
  }, [cache, study.study_id, series, slice]);

  const resetView = () => {
    setZoomStep(0);
    setPan({ x: 0, y: 0 });
  };
  const choosePlane = (p: Plane) => {
    if (!available.includes(p) || p === plane) return;
    const first = study.series.find((s) => s.plane === p) ?? null;
    setPlane(p);
    setSeriesId(first?.series_id ?? null);
    setSlice(first ? middle(first.num_slices) : 0); // switching plane resets to the middle slice
    resetView();
  };
  const chooseSeries = (id: string) => {
    const s = study.series.find((x) => x.series_id === id);
    if (!s) return;
    setSeriesId(id);
    setSlice(middle(s.num_slices));
    resetView();
  };
  const goTo = (i: number) => {
    if (count > 0) setSlice(Math.min(Math.max(i, 0), count - 1));
  };
  const zoomTo = (step: number) => {
    const next = Math.min(Math.max(step, 0), ZOOM_STEPS.length - 1);
    if (next === zoomStep) return;
    const ratio = (ZOOM_STEPS[next] ?? 1) / zoom;
    setZoomStep(next);
    setPan(next === 0 ? { x: 0, y: 0 } : { x: pan.x * ratio, y: pan.y * ratio });
  };

  const planeKey = (p: Plane) => () => choosePlane(p);
  useKeyboardShortcuts({
    j: () => goTo(slice + 1),
    ArrowDown: () => goTo(slice + 1),
    k: () => goTo(slice - 1),
    ArrowUp: () => goTo(slice - 1),
    PageDown: () => goTo(slice + PAGE),
    PageUp: () => goTo(slice - PAGE),
    Home: () => goTo(0),
    End: () => goTo(count - 1),
    '1': planeKey('sagittal'),
    '2': planeKey('coronal'),
    '3': planeKey('axial'),
    '+': () => zoomTo(zoomStep + 1),
    '=': () => zoomTo(zoomStep + 1),
    '-': () => zoomTo(zoomStep - 1),
    '0': resetView,
    '?': () => setSheetOpen(true),
  });

  return (
    <section className="stage" aria-label="Viewer">
      <div className="stage-head">
        <h1>
          <span className="mono">{study.study_id}</span>{' '}
          <span className="muted">{study.display_label}</span>
        </h1>
        <PlaneTabs
          available={available}
          seriesCount={seriesCount}
          plane={plane}
          onChoose={choosePlane}
        />
        {seriesForPlane.length > 0 ? (
          <label className="series-select">
            Series
            <select
              className="field"
              value={series?.series_id ?? ''}
              onChange={(e) => chooseSeries(e.target.value)}
            >
              {seriesForPlane.map((s) => (
                <option key={s.series_id} value={s.series_id}>
                  {s.description ?? s.series_id} ({s.num_slices})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {series && plane ? (
        <SliceCanvas
          studyId={study.study_id}
          series={series}
          plane={plane}
          sliceIndex={slice}
          zoom={zoom}
          pan={pan}
          adjust={adjust}
          cache={cache}
          fixtureStripe={fixtureStripe}
          overlay={overlay}
          onPan={setPan}
        />
      ) : (
        <div className={`viewer${fixtureStripe ? ' fixture' : ''}`}>
          <div className="viewer-msg">This study has no series with a known plane to display.</div>
        </div>
      )}

      <SliceControls
        slice={slice}
        count={count}
        onGoTo={goTo}
        canZoomIn={zoomStep < ZOOM_STEPS.length - 1}
        canZoomOut={zoomStep > 0}
        zoomed={zoomStep > 0}
        onZoomIn={() => zoomTo(zoomStep + 1)}
        onZoomOut={() => zoomTo(zoomStep - 1)}
        onFit={resetView}
        adjust={adjust}
        onAdjust={setAdjust}
        onShowShortcuts={() => setSheetOpen(true)}
      />
      {sheetOpen ? <ShortcutSheet onClose={() => setSheetOpen(false)} /> : null}
    </section>
  );
}
