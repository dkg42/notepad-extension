/**
 * @module useKeyboardShortcuts
 * @description React hook that registers a list of keyboard shortcut definitions for the lifetime of the calling component. It deliberately ignores events originating from input, textarea, or contenteditable elements to avoid interfering with user typing; callers should wrap the shortcuts array in useMemo to prevent unnecessary re-registration.
 * @dependencies none
 * @public ShortcutDef, useKeyboardShortcuts
 */
import { useEffect } from 'react';

export interface ShortcutDef {
  key: string;
  /** Requires Ctrl (Windows) or Cmd (Mac) */
  ctrlOrMeta?: boolean;
  /** Requires Shift */
  shift?: boolean;
  description: string;
  handler: () => void;
}

/**
 * Registers keyboard shortcuts for the lifetime of the component.
 * Pass a stable array (useMemo) to avoid re-registering on every render.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const s of shortcuts) {
        const ctrlMatch = s.ctrlOrMeta ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = s.shift ? e.shiftKey : true;
        if (e.key === s.key && ctrlMatch && shiftMatch) {
          e.preventDefault();
          s.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
