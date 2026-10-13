import { useRef, type KeyboardEvent } from 'react';
import { PLANES, type Plane } from '../../api/types';

export const PLANE_LABEL: Record<Plane, string> = {
  sagittal: 'Sagittal',
  coronal: 'Coronal',
  axial: 'Axial',
};

/**
 * Plane tabs (DESIGN.md section 9.4) with roving tabindex. A missing plane stays in the list
 * as `aria-disabled`, is never focusable, and is skipped by the arrow keys.
 */
export function PlaneTabs({
  available,
  seriesCount,
  plane,
  onChoose,
}: {
  available: readonly Plane[];
  seriesCount: Readonly<Record<Plane, number>>;
  plane: Plane | null;
  onChoose: (p: Plane) => void;
}) {
  const enabled = PLANES.filter((p) => available.includes(p));
  const refs = useRef(new Map<Plane, HTMLButtonElement>());

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (enabled.length === 0) return;
    const at = plane ? enabled.indexOf(plane) : -1;
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = enabled[(at + step + enabled.length) % enabled.length];
    if (!next) return;
    e.preventDefault();
    onChoose(next);
    refs.current.get(next)?.focus();
  };

  // With no selected plane, the first enabled tab keeps the tab stop.
  const tabStop = plane ?? enabled[0] ?? null;

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Plane" onKeyDown={onKeyDown}>
        {PLANES.map((p, idx) => {
          const present = available.includes(p);
          const count = seriesCount[p];
          const reasonId = `tab-${p}-reason`;
          return (
            <button
              key={p}
              ref={(el) => {
                if (el) refs.current.set(p, el);
                else refs.current.delete(p);
              }}
              id={`tab-${p}`}
              type="button"
              role="tab"
              aria-selected={plane === p}
              aria-disabled={present ? undefined : true}
              aria-describedby={present ? undefined : reasonId}
              tabIndex={present && tabStop === p ? 0 : -1}
              title={
                present
                  ? `${PLANE_LABEL[p]} (${idx + 1})`
                  : `${PLANE_LABEL[p]} series not available for this study`
              }
              onClick={() => {
                if (present) onChoose(p);
              }}
            >
              {present ? PLANE_LABEL[p] : `${PLANE_LABEL[p]} — not available`}
              {present && count > 1 ? <span className="mono"> ({count})</span> : null}
            </button>
          );
        })}
      </div>
      {PLANES.filter((p) => !available.includes(p)).map((p) => (
        <span key={p} id={`tab-${p}-reason`} className="sr-only">
          {PLANE_LABEL[p]} series not available for this study
        </span>
      ))}
    </>
  );
}
