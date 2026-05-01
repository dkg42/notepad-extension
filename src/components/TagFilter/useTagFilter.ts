/**
 * @module useTagFilter
 * @description Custom hook managing open/close state and click-outside dismissal for the tag filter dropdown. Provides a toggle handler that adds or removes tags from the active filter set.
 * @dependencies (none — React built-ins only)
 * @public useTagFilter
 */
import { useEffect, useRef, useState } from 'react';

export function useTagFilter(selectedTags: Set<string>, onChange: (tags: Set<string>) => void) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = (tag: string) => {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    onChange(next);
  };

  return { open, setOpen, containerRef, handleToggle };
}