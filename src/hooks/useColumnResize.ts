/**
 * @module useColumnResize
 * @description React hook that adds draggable column-resize handles to an HTML table, persisting per-column widths in localStorage under a caller-supplied key. It handles mouse event cleanup on drag end and enforces a 60px minimum column width to prevent columns from becoming invisible.
 * @dependencies none
 * @public useColumnResize
 */
import { useCallback, useState } from 'react';

type ColumnWidths = Record<string, number>;

function loadWidths(storageKey: string): ColumnWidths {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as ColumnWidths) : {};
  } catch {
    return {};
  }
}

function saveWidths(storageKey: string, widths: ColumnWidths): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // ignore storage errors
  }
}

/**
 * Provides draggable column resize handles for an HTML table.
 * Widths are persisted in localStorage under `storageKey`.
 */
export function useColumnResize(storageKey: string) {
  const [widths, setWidths] = useState<ColumnWidths>(() => loadWidths(storageKey));

  const startResize = useCallback(
    (column: string, currentWidth: number) =>
      (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;

        const onMouseMove = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientX - startX;
          const newWidth = Math.max(60, currentWidth + delta);
          setWidths((prev) => {
            const next = { ...prev, [column]: newWidth };
            saveWidths(storageKey, next);
            return next;
          });
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
    [storageKey],
  );

  const getWidth = (column: string, defaultWidth: number): number =>
    widths[column] ?? defaultWidth;

  const resetWidths = () => {
    setWidths({});
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  return { widths, startResize, getWidth, resetWidths };
}
