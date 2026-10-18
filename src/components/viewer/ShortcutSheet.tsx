import { useEffect, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

/** Mirrors DESIGN.md section 12. Keys listed here are the ones the review page binds. */
export const SHORTCUTS: readonly { keys: string[]; action: string }[] = [
  { keys: ['↑', 'k'], action: 'Previous slice' },
  { keys: ['↓', 'j'], action: 'Next slice' },
  { keys: ['PageUp', 'PageDown'], action: 'Back / forward 10 slices' },
  { keys: ['Home', 'End'], action: 'First / last slice' },
  { keys: ['1', '2', '3'], action: 'Sagittal / coronal / axial (skips missing planes)' },
  { keys: ['+', '-', '0'], action: 'Zoom in / zoom out / fit' },
  { keys: ['r'], action: 'Run analysis (when enabled)' },
  { keys: ['?'], action: 'Open this sheet' },
  { keys: ['Esc'], action: 'Close this sheet' },
];

/**
 * Modal list of keyboard shortcuts. Focus moves into the sheet on open and returns to the
 * previously focused element on close. Keys pressed inside never reach the page shortcuts.
 */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // modal: page shortcuts stay quiet while the sheet is open
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // the close button is the only tab stop in the sheet
      closeButton.current?.focus();
    }
  };

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-sheet-title"
      onKeyDown={onKeyDown}
    >
      <div className="sheet-head">
        <h2 id="shortcut-sheet-title">Keyboard shortcuts</h2>
        <button
          ref={closeButton}
          type="button"
          className="btn icon-btn"
          aria-label="Close keyboard shortcuts"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X className="i" aria-hidden="true" />
        </button>
      </div>
      <table>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.action}>
              <th scope="row">
                {s.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </th>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="faint">Shortcuts do not fire while a field or menu has focus.</p>
    </div>
  );
}
