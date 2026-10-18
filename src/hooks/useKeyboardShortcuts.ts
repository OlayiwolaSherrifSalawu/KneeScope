import { useEffect, useRef } from 'react';

export type ShortcutMap = Readonly<Record<string, (e: KeyboardEvent) => void>>;

/** True when the key event came from a control that owns typing (DESIGN.md section 12). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

/**
 * Window-level keyboard shortcuts keyed by `KeyboardEvent.key`. Never fires while an input,
 * select or textarea has focus, or with Ctrl/Meta/Alt held. A handled key is prevented.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  const latest = useRef({ shortcuts, enabled });
  useEffect(() => {
    latest.current = { shortcuts, enabled };
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { shortcuts: map, enabled: on } = latest.current;
      if (!on || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const handler = Object.hasOwn(map, e.key) ? map[e.key] : undefined;
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
