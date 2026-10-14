import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export type Adjust = { brightness: number; contrast: number };
export const NEUTRAL_ADJUST: Adjust = { brightness: 100, contrast: 100 };

/** CSS filter for the canvas. This only changes how the rendered PNG is shown. */
export function adjustFilter({ brightness, contrast }: Adjust): string | undefined {
  if (brightness === 100 && contrast === 100) return undefined;
  return `brightness(${brightness}%) contrast(${contrast}%)`;
}

/**
 * Brightness and contrast applied to the rendered 8-bit PNG (DESIGN.md section 14). It is a
 * display adjustment, not MRI window/level, and the accessible name says so.
 */
export function DisplayAdjust({
  value,
  onChange,
}: {
  value: Adjust;
  onChange: (next: Adjust) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div className="adjust" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className="btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Display adjust (not window/level)"
        title="Display adjust (not window/level): brightness and contrast of the rendered PNG"
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal className="i" aria-hidden="true" />
        Display adjust
      </button>
      {open ? (
        <div id={panelId} className="popover" role="group" aria-label="Display adjust">
          <p className="faint">
            Brightness and contrast of the rendered PNG. This is not window/level.
          </p>
          <label>
            Brightness
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={value.brightness}
              aria-valuetext={`${value.brightness}%`}
              onChange={(e) => onChange({ ...value, brightness: Number(e.target.value) })}
            />
            <span className="mono">{value.brightness}%</span>
          </label>
          <label>
            Contrast
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={value.contrast}
              aria-valuetext={`${value.contrast}%`}
              onChange={(e) => onChange({ ...value, contrast: Number(e.target.value) })}
            />
            <span className="mono">{value.contrast}%</span>
          </label>
          <button type="button" className="btn" onClick={() => onChange(NEUTRAL_ADJUST)}>
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}
