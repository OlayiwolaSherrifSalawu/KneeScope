import type { Plane } from '../../api/types';
import { ErrorPanel } from '../ErrorPanel';
import { StateGlyph } from '../StateGlyph';
import { PLANE_LABEL } from '../viewer/PlaneTabs';
import type { OverlayCheck } from './alignment';
import type { ExplanationState } from './useExplanation';

const DEFAULT_NOTICE = 'Shows what influenced the model score; it does not localise an injury.';

function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="msg">
      <StateGlyph status="unavailable" />
      <div>
        <h4>Explanation unavailable</h4>
        <p>{reason}</p>
      </div>
    </div>
  );
}

/**
 * Explanation panel (DESIGN.md sections 9.9 and 14). Named "Influential slices" or
 * "Model attention" — never lesion or tear location. Slice chips jump the viewer to the
 * referenced series and slice. The overlay is drawn only when `overlay.ok` (alignment
 * check); otherwise the reason is shown and nothing is drawn.
 */
export function ExplanationPanel({
  findingName,
  state,
  overlay,
  overlayOn,
  opacity,
  onToggleOverlay,
  onOpacity,
  onJump,
}: {
  findingName: string | null;
  state: ExplanationState & { reload: () => void };
  /** Alignment of the attention map with the displayed slice; null without maps. */
  overlay: OverlayCheck | null;
  overlayOn: boolean;
  opacity: number;
  onToggleOverlay: (on: boolean) => void;
  onOpacity: (value: number) => void;
  onJump: (seriesId: string, plane: Plane, sliceIndex: number) => void;
}) {
  if (!findingName) return null;
  const e = state.phase === 'ready' ? state.explanation : null;
  const kind = e?.kind === 'attention_map' ? 'Model attention' : 'Influential slices';
  const hasMaps = (e?.attention?.length ?? 0) > 0;

  return (
    <section className="explain" aria-label={`${findingName} explanation`}>
      <h3>
        {findingName} · {e && e.status === 'available' ? kind : 'Explanation'}
        {e?.source === 'fixture' ? <span className="faint"> (fixture)</span> : null}
      </h3>

      {state.phase === 'none' ? <Unavailable reason={state.reason} /> : null}
      {state.phase === 'loading' ? <p className="faint">Loading explanation…</p> : null}
      {state.phase === 'error' ? (
        <ErrorPanel
          error={state.error}
          title="Explanation could not be loaded"
          onRetry={state.reload}
        />
      ) : null}
      {e && e.status === 'unavailable' ? (
        <Unavailable reason={e.reason?.message ?? 'No explanation was produced.'} />
      ) : null}

      {e && e.status === 'available' && e.series_id && e.plane ? (
        <>
          <div className="slice-chips" role="list" aria-label="Influential slices">
            {[...(e.slices ?? [])]
              .sort((a, b) => b.weight - a.weight)
              .map((s) => (
                <button
                  key={s.slice_index}
                  type="button"
                  role="listitem"
                  className="btn mono"
                  aria-label={`Jump to ${PLANE_LABEL[e.plane as Plane]} slice ${s.slice_index + 1} (relative weight ${s.weight.toFixed(2)})`}
                  onClick={() => onJump(e.series_id as string, e.plane as Plane, s.slice_index)}
                >
                  {s.slice_index + 1}
                </button>
              ))}
          </div>
          {hasMaps ? (
            <div className="overlay-controls">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={overlayOn}
                  onChange={(ev) => onToggleOverlay(ev.target.checked)}
                />
                Show model attention overlay
              </label>
              <label className="opacity">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={opacity}
                  disabled={!overlayOn}
                  aria-valuetext={`${Math.round(opacity * 100)} percent`}
                  onChange={(ev) => onOpacity(Number(ev.target.value))}
                />
              </label>
              <div className="legend">
                <span className="ramp" aria-hidden="true">
                  <i className="r1" />
                  <i className="r2" />
                  <i className="r3" />
                </span>
                Model attention (relative, not lesion location)
              </div>
              {overlayOn && overlay && !overlay.ok ? (
                <Unavailable reason={`Alignment check failed: ${overlay.reason}`} />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <p className="note">{e?.notice ?? DEFAULT_NOTICE}</p>
    </section>
  );
}
