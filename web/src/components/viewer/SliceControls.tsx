import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Keyboard,
  Maximize,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DisplayAdjust, type Adjust } from './DisplayAdjust';

/** The 40px strip directly beneath the image (DESIGN.md section 6, 9.5). */
export function SliceControls({
  slice,
  count,
  onGoTo,
  canZoomIn,
  canZoomOut,
  zoomed,
  onZoomIn,
  onZoomOut,
  onFit,
  adjust,
  onAdjust,
  onShowShortcuts,
}: {
  /** 0-based, as in the API; shown 1-based. */
  slice: number;
  /** Number of slices in the selected series; 0 when there is no series. */
  count: number;
  onGoTo: (index: number) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomed: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  adjust: Adjust;
  onAdjust: (next: Adjust) => void;
  onShowShortcuts: () => void;
}) {
  const has = count > 0;
  return (
    <div className="controls" role="group" aria-label="Slice controls">
      <button
        type="button"
        className="btn icon-btn"
        aria-label="First slice"
        title="First slice (Home)"
        disabled={!has}
        onClick={() => onGoTo(0)}
      >
        <ChevronsLeft className="i" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Previous slice"
        title="Previous slice (k, ↑)"
        disabled={!has}
        onClick={() => onGoTo(slice - 1)}
      >
        <ChevronLeft className="i" aria-hidden="true" />
      </button>
      <input
        type="range"
        aria-label="Slice"
        min={1}
        max={Math.max(count, 1)}
        value={slice + 1}
        disabled={!has}
        aria-valuetext={`Slice ${slice + 1} of ${count}`}
        onChange={(e) => onGoTo(Number(e.target.value) - 1)}
      />
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Next slice"
        title="Next slice (j, ↓)"
        disabled={!has}
        onClick={() => onGoTo(slice + 1)}
      >
        <ChevronRight className="i" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Last slice"
        title="Last slice (End)"
        disabled={!has}
        onClick={() => onGoTo(count - 1)}
      >
        <ChevronsRight className="i" aria-hidden="true" />
      </button>
      <span className="mono slice-readout" data-testid="slice-readout">
        {has ? `${slice + 1} / ${count}` : '— / —'}
      </span>
      <span className="controls-sep" aria-hidden="true" />
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Zoom out"
        title="Zoom out (-)"
        disabled={!has || !canZoomOut}
        onClick={onZoomOut}
      >
        <ZoomOut className="i" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Zoom in"
        title="Zoom in (+)"
        disabled={!has || !canZoomIn}
        onClick={onZoomIn}
      >
        <ZoomIn className="i" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn icon-btn"
        aria-label="Fit to window"
        title="Fit (0)"
        disabled={!has || !zoomed}
        onClick={onFit}
      >
        <Maximize className="i" aria-hidden="true" />
      </button>
      <DisplayAdjust value={adjust} onChange={onAdjust} />
      <button
        type="button"
        className="btn icon-btn shortcuts-btn"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={onShowShortcuts}
      >
        <Keyboard className="i" aria-hidden="true" />
      </button>
    </div>
  );
}
