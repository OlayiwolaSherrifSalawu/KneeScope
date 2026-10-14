import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { diagnoseSliceFailure, sliceUrl, type ApiRequestError } from '../../api/client';
import type { AttentionMap, Plane, SeriesSummary } from '../../api/types';
import { attentionRgba } from '../explanations/alignment';
import { adjustFilter, type Adjust } from './DisplayAdjust';
import { SliceImageCache } from './sliceImageCache';

export type Pan = { x: number; y: number };

/** An attention map that already passed the alignment check, and its display opacity. */
export type OverlayLayer = { map: AttentionMap; opacity: number };

/** Decode a gray8 PNG attention map and paint it with the ochre-to-rust ramp. */
function paintOverlay(canvas: HTMLCanvasElement, layer: OverlayLayer, onDone: () => void) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    const { width, height } = layer.map;
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const sctx = scratch.getContext('2d');
    if (!sctx || typeof sctx.getImageData !== 'function') return;
    sctx.drawImage(img, 0, 0, width, height);
    let data: ImageData;
    try {
      data = sctx.getImageData(0, 0, width, height);
    } catch {
      return; // no pixel access: draw nothing rather than a wrong overlay
    }
    for (let i = 0; i < data.data.length; i += 4) {
      const [r, g, b, a] = attentionRgba((data.data[i] ?? 0) / 255, layer.opacity);
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
      data.data[i + 3] = a;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(data, 0, 0);
    onDone();
  };
  img.src = `data:image/png;base64,${layer.map.data}`;
}

/** Above this effective scale (rendered PNG pixels to screen pixels) draw nearest-neighbour. */
export const NEAREST_NEIGHBOUR_ABOVE = 2;

type Loaded =
  | { url: string; attempt: number; status: 'ready' }
  | { url: string; attempt: number; status: 'error'; error: ApiRequestError };

/** Largest pan (screen px) that keeps the zoomed image overlapping the well. */
function panLimit(image: number, well: number, zoom: number): number {
  return Math.max(0, (image * zoom - well) / 2);
}

/**
 * The viewer well: a neutral, near-black frame around a canvas that draws the server-rendered
 * PNG. `sliceIndex` is 0-based (API); annotations show it 1-based. No crosshairs; the only
 * overlay is an aligned attention map passed in by the caller. No motion between slices; the previous slice stays until the next one has loaded.
 */
export function SliceCanvas({
  studyId,
  series,
  plane,
  sliceIndex,
  zoom,
  pan,
  adjust,
  cache,
  fixtureStripe,
  overlay = null,
  onPan,
}: {
  studyId: string;
  series: SeriesSummary;
  plane: Plane;
  sliceIndex: number;
  zoom: number;
  pan: Pan;
  adjust: Adjust;
  cache: SliceImageCache;
  fixtureStripe: boolean;
  /** Drawn only when given; the caller has already checked alignment (DESIGN.md section 14). */
  overlay?: OverlayLayer | null;
  onPan: (next: Pan) => void;
}) {
  const wellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [overlayDrawn, setOverlayDrawn] = useState<OverlayLayer | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; pan: Pan } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [wellSize, setWellSize] = useState<{ width: number; height: number } | null>(null);
  const { rendered_width: width, rendered_height: height, num_slices: total } = series;
  const url = sliceUrl(studyId, series.series_id, sliceIndex);

  useEffect(() => {
    let cancelled = false;
    cache.load(url).then(
      (img) => {
        if (cancelled) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        setLoaded({ url, attempt, status: 'ready' });
      },
      async () => {
        const error = await diagnoseSliceFailure(url);
        if (!cancelled) setLoaded({ url, attempt, status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cache, url, width, height, attempt]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !overlay) return;
    let cancelled = false;
    paintOverlay(canvas, overlay, () => {
      if (!cancelled) setOverlayDrawn(overlay);
    });
    return () => {
      cancelled = true;
    };
  }, [overlay]);

  useEffect(() => {
    const well = wellRef.current;
    if (!well || typeof ResizeObserver === 'undefined') return;
    const measure = () => setWellSize({ width: well.clientWidth, height: well.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(well);
    return () => observer.disconnect();
  }, []);

  // Scale that makes the PNG fit the well; unknown (tests, first paint) counts as 1:1.
  const fitScale =
    wellSize && wellSize.width > 0 && wellSize.height > 0
      ? Math.min(wellSize.width / width, wellSize.height / height)
      : 1;
  const effective = fitScale * zoom;
  const nearest = effective > NEAREST_NEIGHBOUR_ABOVE;
  const zoomLabel = `${Math.round(effective * 100)}%${zoom === 1 ? ' (fit)' : ''}`;

  const current = loaded?.url === url && loaded.attempt === attempt ? loaded : null;
  const failed = current?.status === 'error' ? current : null;
  // The last drawn slice stays visible while the next one loads; an error hides it.
  const visible = loaded?.status === 'ready';
  const label = `Study ${studyId}, series ${series.description ?? series.series_id}, ${plane} plane, slice ${sliceIndex + 1} of ${total}`;

  const clampPan = (p: Pan): Pan => {
    const well = wellSize ?? { width: 0, height: 0 };
    const x = panLimit(width * fitScale, well.width, zoom);
    const y = panLimit(height * fitScale, well.height, zoom);
    return {
      x: Math.min(Math.max(p.x, -x), x),
      y: Math.min(Math.max(p.y, -y), y),
    };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || zoom <= 1) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    onPan(clampPan({ x: d.pan.x + e.clientX - d.x, y: d.pan.y + e.clientY - d.y }));
  };
  const endDrag = (e: PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={wellRef}
      className={`viewer${fixtureStripe ? ' fixture' : ''}${zoom > 1 ? ' zoomed' : ''}${dragging ? ' dragging' : ''}`}
      data-testid="viewer-well"
      aria-busy={current === null}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        data-zoom={zoom}
        data-rendering={nearest ? 'nearest-neighbour' : 'smooth'}
        className={nearest ? 'pixelated' : undefined}
        style={{
          // Keep the previous slice visible while the next loads: no flicker, no transition.
          visibility: visible ? 'visible' : 'hidden',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          filter: adjustFilter(adjust),
        }}
      />
      {overlay ? (
        <canvas
          ref={overlayRef}
          className={`attention-overlay${nearest ? ' pixelated' : ''}`}
          width={overlay.map.width}
          height={overlay.map.height}
          aria-hidden="true"
          data-testid="attention-overlay"
          data-slice-index={overlay.map.slice_index}
          style={{
            visibility: overlayDrawn === overlay && visible ? 'visible' : 'hidden',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      ) : null}
      <div className="corner tl">
        {studyId}
        <br />
        {series.description ?? series.series_id}
      </div>
      <div className="corner tr">Rendered slice (PNG)</div>
      <div className="corner bl">
        {sliceIndex + 1} / {total}
        <br />
        {plane}
      </div>
      <div className="corner br">{zoomLabel}</div>
      {current === null && loaded === null ? (
        <div className="viewer-msg">Loading slice…</div>
      ) : null}
      {failed ? (
        <div className="viewer-msg" role="alert">
          <div>
            <p>Slice image could not be loaded.</p>
            <p className="code-line">
              <span className="mono">{failed.error.code}</span>
              {failed.error.requestId ? (
                <span className="mono"> · request {failed.error.requestId}</span>
              ) : null}
            </p>
            <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
