/**
 * @module useDashboardHome
 * @description Pure-computation hook for the Dashboard Home page that derives summary statistics: total unique tag count, the five most recent snippets, a folder id-to-name map, per-folder snippet counts, and a 12-week capture-activity heatmap (snippets + chats + notebooks bucketed by day).
 * @dependencies @/types, @/types/chat-history
 * @public useDashboardHome
 */
import { useMemo } from 'react';
import type { Folder, NotebookMeta, Snippet } from '@/types';
import type { ConversationMeta } from '@/types/chat-history';

export interface HeatmapCell {
  label: string;
  count: number;
  level: number;
}

const HEATMAP_WEEKS = 12;
const HEATMAP_DAYS = 7;

const dayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function useDashboardHome(
  snippets: Snippet[],
  folders: Folder[],
  conversations: ConversationMeta[],
  notebooks: NotebookMeta[],
) {
  const totalTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return tagSet.size;
  }, [snippets]);

  const recentSnippets = useMemo(() => snippets.slice(0, 5), [snippets]);

  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const snippetsPerFolder = useMemo(() => {
    const counts = new Map<string, number>();
    snippets.forEach((s) => {
      const key = s.folderId ?? '__uncategorized__';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [snippets]);

  const captureActivity = useMemo(() => {
    const dayCount = HEATMAP_WEEKS * HEATMAP_DAYS;

    // Ordered list of the last `dayCount` days (oldest → today), each at local midnight.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    const counts = new Map<string, number>();
    for (const day of days) counts.set(dayKey(day.getTime()), 0);

    const tally = (ts: number | undefined) => {
      if (typeof ts !== 'number' || Number.isNaN(ts)) return;
      const key = dayKey(ts);
      if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
    };

    snippets.forEach((s) => tally(s.savedAt));
    conversations.forEach((c) => tally(c.createdAt));
    notebooks.forEach((n) => tally(n.createdAt));

    const dailyCounts = days.map((d) => counts.get(dayKey(d.getTime())) ?? 0);
    const maxCount = Math.max(0, ...dailyCounts);
    const labelFmt = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const cells: HeatmapCell[] = days.map((d, i) => {
      const count = dailyCounts[i];
      return {
        label: labelFmt.format(d),
        count,
        level: count === 0 ? 0 : Math.max(1, Math.ceil((count / maxCount) * 4)),
      };
    });

    const windowTotal = dailyCounts.reduce((sum, c) => sum + c, 0);
    return { cells, windowTotal };
  }, [snippets, conversations, notebooks]);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  return {
    totalTags,
    recentSnippets,
    folderMap,
    snippetsPerFolder,
    captureActivity,
    formattedDate,
  };
}
