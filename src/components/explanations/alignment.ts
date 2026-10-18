import type { AttentionMap, Explanation } from '../../api/types';

/** What the viewer is showing right now. `sliceIndex` is 0-based (API coordinates). */
export type ViewerPosition = {
  seriesId: string;
  sliceIndex: number;
  renderedWidth: number;
  renderedHeight: number;
};

/** The prediction whose scores are on screen. */
export type ShownPrediction = { predictionId: string; modelVersion: string };

export type OverlayCheck =
  { ok: true; map: AttentionMap } | { ok: false; reason: string; drawable: false };

/**
 * DESIGN.md section 14: an attention map is drawn only when its series, slice, rendered size,
 * prediction and model version all match what is displayed. Anything else is "alignment check
 * failed" — never a best-effort overlay.
 */
export function checkOverlay(
  explanation: Explanation,
  position: ViewerPosition | null,
  shown: ShownPrediction,
): OverlayCheck {
  const fail = (reason: string): OverlayCheck => ({ ok: false, reason, drawable: false });
  if (explanation.status !== 'available') return fail('Explanation unavailable.');
  if (explanation.prediction_id !== shown.predictionId)
    return fail('Explanation belongs to a different prediction.');
  if (explanation.model_version !== shown.modelVersion)
    return fail('Explanation was produced by a different model version.');
  if (!position) return fail('No slice is displayed.');
  if (explanation.series_id !== position.seriesId)
    return fail(
      `Overlay was computed for series ${explanation.series_id ?? 'unknown'}, the viewer shows ${position.seriesId}.`,
    );
  if (
    explanation.rendered_width !== position.renderedWidth ||
    explanation.rendered_height !== position.renderedHeight
  )
    return fail('Overlay size does not match the rendered slice.');
  const map = (explanation.attention ?? []).find((m) => m.slice_index === position.sliceIndex);
  if (!map) return fail('No attention map for this slice.');
  if (map.width !== position.renderedWidth || map.height !== position.renderedHeight)
    return fail('Attention map size does not match the rendered slice.');
  return { ok: true, map };
}

/**
 * Single-hue ochre to rust ramp (DESIGN.md sections 4.3 and 14): relative attention 0..1 to
 * RGBA, alpha rising with attention. Never a rainbow ("jet") colour map.
 */
export function attentionRgba(value: number, opacity: number): [number, number, number, number] {
  const v = Math.min(Math.max(value, 0), 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * v);
  // ochre #C9944A -> rust #B2542C
  return [lerp(0xc9, 0xb2), lerp(0x94, 0x54), lerp(0x4a, 0x2c), Math.round(255 * v * opacity)];
}
