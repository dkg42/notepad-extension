/**
 * @module useCommandPalette
 * @description Hook for the command palette (Ctrl/Cmd+K) that merges navigation actions, folders, tags, and prompt search results into a unified filterable list. Supports keyboard navigation (arrows, Enter, Escape) and resets the active index on every query change.
 * @dependencies @/types, @/types/dashboard
 * @public useCommandPalette, PaletteItem
 */
import { useEffect, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import type { DashboardView } from '@/types/dashboard';

export interface PaletteItem {
  id: string;
  type: 'prompt' | 'folder' | 'tag' | 'action';
  label: string;
  sublabel?: string;
  onSelect: () => void;
}

const ACTIONS: Array<{ view: DashboardView; label: string; icon: string }> = [
  { view: 'home', label: 'Go to Home', icon: '⌂' },
  { view: 'prompts', label: 'Browse Prompts', icon: '≡' },
  { view: 'favorites', label: 'View Favorites', icon: '★' },
  { view: 'folders', label: 'Manage Folders', icon: '◫' },
  { view: 'tags', label: 'Manage Tags', icon: '◈' },
  { view: 'analytics', label: 'View Analytics', icon: '◉' },
  { view: 'settings', label: 'Open Settings', icon: '⚙' },
];

export function useCommandPalette(
  snippets: Snippet[],
  folders: Folder[],
  onNavigate: (view: DashboardView) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const open = () => {
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? close() : open();
      }
      if (e.key === 'Escape' && isOpen) close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [snippets]);

  const items = useMemo((): PaletteItem[] => {
    const q = query.toLowerCase().trim();

    const actions: PaletteItem[] = ACTIONS.filter(
      (a) => !q || a.label.toLowerCase().includes(q),
    ).map((a) => ({
      id: `action-${a.view}`,
      type: 'action' as const,
      label: `${a.icon} ${a.label}`,
      onSelect: () => {
        onNavigate(a.view);
        close();
      },
    }));

    const folderItems: PaletteItem[] = folders
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((f) => ({
        id: `folder-${f.id}`,
        type: 'folder' as const,
        label: `◫ ${f.name}`,
        sublabel: 'Folder',
        onSelect: () => {
          onNavigate('folders');
          close();
        },
      }));

    const tagItems: PaletteItem[] = allTags
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        id: `tag-${t}`,
        type: 'tag' as const,
        label: `◈ ${t}`,
        sublabel: 'Tag',
        onSelect: () => {
          onNavigate('tags');
          close();
        },
      }));

    const promptItems: PaletteItem[] = snippets
      .filter((s) => q && s.text.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({
        id: `prompt-${s.id}`,
        type: 'prompt' as const,
        label: s.text.slice(0, 60) + (s.text.length > 60 ? '…' : ''),
        sublabel: 'Prompt',
        onSelect: () => {
          onNavigate('prompts');
          close();
        },
      }));

    return [...actions, ...folderItems, ...tagItems, ...promptItems];
  }, [query, snippets, folders, allTags, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.onSelect();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  useEffect(() => setActiveIndex(0), [query]);

  return { isOpen, query, setQuery, items, activeIndex, setActiveIndex, open, close, handleKeyDown };
}
