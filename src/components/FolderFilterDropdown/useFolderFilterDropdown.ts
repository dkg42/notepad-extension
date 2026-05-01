/**
 * @module useFolderFilterDropdown
 * @description Custom hook managing open/close state and click-outside dismissal for the folder filter dropdown. Exposes a toggle handler that adds or removes a folder ID from the active selection set.
 * @dependencies (none — React built-ins only)
 * @public useFolderFilterDropdown
 */
import { useEffect, useRef, useState } from 'react';

export function useFolderFilterDropdown(
  selectedIds: Set<string>,
  onChange: (ids: Set<string>) => void,
) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return { open, setOpen, ref, handleToggle };
}