/**
 * @module useCommandPalette
 * @description Hook for the command palette (Ctrl/Cmd+K) that searches across all dashboard
 * content — prompts, notebooks, chats, podcasts, pipelines, folders, tags, and settings.
 * @dependencies @/types, @/types/dashboard, @/types/chat-history, @/types/pipeline
 * @public useCommandPalette, PaletteItem
 */
import { useEffect, useMemo, useState } from 'react';
import type { Folder, NotebookMeta, PodcastEpisode, Snippet } from '@/types';
import type { ConversationMeta } from '@/types/chat-history';
import type { Pipeline } from '@/types/pipeline';
import type { DashboardView } from '@/types/dashboard';

export interface PaletteItem {
  id: string;
  type: 'prompt' | 'folder' | 'tag' | 'notebook' | 'chat' | 'podcast' | 'pipeline' | 'action' | 'section';
  label: string;
  sublabel?: string;
  onSelect: () => void;
}

const NAV_ACTIONS: Array<{ view: DashboardView; label: string; icon: string }> = [
  { view: 'home',          label: 'Home',            icon: '⌂' },
  { view: 'prompts',       label: 'Prompt Hub',       icon: '≡' },
  { view: 'notebooks',     label: 'Notebooks',        icon: '◻' },
  { view: 'all-sources',   label: 'All Sources',      icon: '◈' },
  { view: 'all-artifacts', label: 'All Artifacts',    icon: '◷' },
  { view: 'all-audio',     label: 'All Audio',        icon: '♫' },
  { view: 'chat-history',  label: 'Chat History',     icon: '◉' },
  { view: 'podcasts',      label: 'Podcasts',         icon: '◎' },
  { view: 'pipelines',     label: 'Pipelines',        icon: '⇢' },
  { view: 'folders',       label: 'Folders',          icon: '◫' },
  { view: 'tags',          label: 'Tags',             icon: '◈' },
  { view: 'analytics',     label: 'Analytics',        icon: '◉' },
  { view: 'settings',      label: 'Settings',         icon: '⚙' },
  { view: 'export-history', label: 'Export History',  icon: '↗' },
];

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function section(label: string): PaletteItem {
  return { id: `section-${label}`, type: 'section', label, onSelect: () => {} };
}

export function useCommandPalette(
  snippets: Snippet[],
  folders: Folder[],
  notebooks: NotebookMeta[],
  conversations: ConversationMeta[],
  pipelines: Pipeline[],
  podcastEpisodes: PodcastEpisode[],
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
    const result: PaletteItem[] = [];

    const matches = (text: string | undefined | null) =>
      !!(text && text.toLowerCase().includes(q));

    // ── Prompts ───────────────────────────────────────────────────────────────
    const displayText = (s: Snippet) => {
      const t = s.title?.trim();
      return t || s.text;
    };

    const matchedPrompts = q
      ? snippets.filter((s) => matches(s.title) || matches(s.text))
      : [...snippets].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

    const promptSlice = matchedPrompts.slice(0, 5);
    if (promptSlice.length > 0) {
      result.push(section(q ? 'Prompt Hub' : 'Recent prompts'));
      promptSlice.forEach((s) => {
        const display = displayText(s);
        result.push({
          id: `prompt-${s.id}`,
          type: 'prompt',
          label: display.slice(0, 60) + (display.length > 60 ? '…' : ''),
          sublabel: 'Prompt',
          onSelect: () => { onNavigate('prompts'); close(); },
        });
      });
    }

    // ── Notebooks ─────────────────────────────────────────────────────────────
    const matchedNotebooks = notebooks
      .filter((n) => !q || matches(n.title))
      .slice(0, 5);
    if (matchedNotebooks.length > 0) {
      result.push(section('Notebooks'));
      matchedNotebooks.forEach((n) =>
        result.push({
          id: `notebook-${n.id}`,
          type: 'notebook',
          label: n.title,
          sublabel: 'Notebook',
          onSelect: () => { onNavigate('notebooks'); close(); },
        }),
      );
    }

    // ── Chat conversations ────────────────────────────────────────────────────
    const matchedChats = conversations
      .filter((c) => !q || matches(c.title))
      .slice(0, 5);
    if (matchedChats.length > 0) {
      result.push(section('Chats'));
      matchedChats.forEach((c) =>
        result.push({
          id: `chat-${c.id}`,
          type: 'chat',
          label: c.title,
          sublabel: PLATFORM_LABELS[c.platform] ?? c.platform,
          onSelect: () => { onNavigate('chat-history'); close(); },
        }),
      );
    }

    // ── Podcast episodes ──────────────────────────────────────────────────────
    const matchedPodcasts = podcastEpisodes
      .filter((e) => !q || matches(e.title) || matches(e.description))
      .slice(0, 5);
    if (matchedPodcasts.length > 0) {
      result.push(section('Podcasts'));
      matchedPodcasts.forEach((e) =>
        result.push({
          id: `podcast-${e.id}`,
          type: 'podcast',
          label: e.title,
          sublabel: 'Podcast',
          onSelect: () => { onNavigate('podcasts'); close(); },
        }),
      );
    }

    // ── Pipelines ─────────────────────────────────────────────────────────────
    const matchedPipelines = pipelines
      .filter((p) => !q || matches(p.name) || matches(p.description))
      .slice(0, 5);
    if (matchedPipelines.length > 0) {
      result.push(section('Pipelines'));
      matchedPipelines.forEach((p) =>
        result.push({
          id: `pipeline-${p.id}`,
          type: 'pipeline',
          label: p.name,
          sublabel: p.enabled ? 'Active' : 'Disabled',
          onSelect: () => { onNavigate('pipelines'); close(); },
        }),
      );
    }

    // ── Folders ───────────────────────────────────────────────────────────────
    const matchedFolders = folders
      .filter((f) => !q || matches(f.name))
      .slice(0, 5);
    if (matchedFolders.length > 0) {
      result.push(section('Folders'));
      matchedFolders.forEach((f) =>
        result.push({
          id: `folder-${f.id}`,
          type: 'folder',
          label: f.name,
          sublabel: 'Folder',
          onSelect: () => { onNavigate('folders'); close(); },
        }),
      );
    }

    // ── Tags ──────────────────────────────────────────────────────────────────
    const matchedTags = allTags
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 5);
    if (matchedTags.length > 0) {
      result.push(section('Tags'));
      matchedTags.forEach((t) =>
        result.push({
          id: `tag-${t}`,
          type: 'tag',
          label: t,
          sublabel: 'Tag',
          onSelect: () => { onNavigate('tags'); close(); },
        }),
      );
    }

    // ── Navigation / settings ─────────────────────────────────────────────────
    const matchedActions = NAV_ACTIONS.filter(
      (a) => !q || a.label.toLowerCase().includes(q),
    );
    if (matchedActions.length > 0) {
      result.push(section('Navigate'));
      matchedActions.forEach((a) =>
        result.push({
          id: `action-${a.view}`,
          type: 'action',
          label: `${a.icon} ${a.label}`,
          onSelect: () => { onNavigate(a.view); close(); },
        }),
      );
    }

    return result;
  }, [query, snippets, folders, notebooks, conversations, podcastEpisodes, pipelines, allTags, onNavigate]);

  const selectableItems = useMemo(
    () => items.filter((item) => item.type !== 'section'),
    [items],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectableItems[activeIndex]?.onSelect();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  useEffect(() => setActiveIndex(0), [query]);

  return { isOpen, query, setQuery, items, selectableItems, activeIndex, setActiveIndex, open, close, handleKeyDown };
}
