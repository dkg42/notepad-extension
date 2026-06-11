/**
 * @module useTabManagerView
 * @description Hook for the Tab Manager sidebar view — loads open browser tabs,
 *   persists user-defined tab groups, and provides actions for group CRUD, tab
 *   assignment, and bulk open/close. Tab IDs are synced with live tabs on every
 *   Chrome tab event; URLs are retained for cross-session restore.
 * @dependencies @/types/tab-groups, @/services/tab-groups-storage
 * @public useTabManagerView
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TabGroup, StashedTab, GroupColor } from '@/types/tab-groups';
import { tabGroupsStorage } from '@/services/tab-groups-storage';
import { aiService } from '@/services/ai-service';
import { recentActionsStorage } from '@/services/storage/recent-actions-storage';

export const COLORS: GroupColor[] = ['primary', 'green', 'sky', 'rose', 'violet'];

/** Case-insensitive match of a tab's title or hostname against a lowercased query. */
function tabMatchesQuery(title: string | undefined, url: string | undefined, q: string): boolean {
  if (title && title.toLowerCase().includes(q)) return true;
  if (url) {
    let hostname = url;
    try { hostname = new URL(url).hostname; } catch { /* keep raw url */ }
    if (hostname.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function useTabManagerView() {
  const [openTabs, setOpenTabs] = useState<chrome.tabs.Tab[]>([]);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<GroupColor>('primary');
  const [generatingContextId, setGeneratingContextId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cache tab metadata so it's available when onRemoved fires (chrome only gives us the ID)
  const tabMetadataCacheRef = useRef<Map<number, chrome.tabs.Tab>>(new Map());

  // Refresh live tabs: stash closed grouped tabs, auto-restore stashed tabs that are now live
  const refreshTabs = useCallback(async () => {
    const liveTabs = await chrome.tabs.query({});

    // Keep metadata cache up to date
    for (const t of liveTabs) {
      if (t.id != null) tabMetadataCacheRef.current.set(t.id, t);
    }

    const liveIdSet = new Set(liveTabs.filter((t) => t.id != null).map((t) => t.id!));
    const liveUrlToId = new Map(
      liveTabs.filter((t) => t.id != null && t.url).map((t) => [t.url!, t.id!]),
    );

    setOpenTabs(liveTabs);
    setGroups((prev) => {
      let changed = false;
      const updated = prev.map((g) => {
        const closedIds = g.tabIds.filter((id) => !liveIdSet.has(id));
        const restoredStashed = (g.stashedTabs ?? []).filter((s) => liveUrlToId.has(s.url));

        if (closedIds.length === 0 && restoredStashed.length === 0) return g;
        changed = true;

        // Build updated stashed list: add newly-closed, remove restored
        const restoredUrls = new Set(restoredStashed.map((s) => s.url));
        const nextStashed: StashedTab[] = (g.stashedTabs ?? []).filter(
          (s) => !restoredUrls.has(s.url),
        );
        for (const id of closedIds) {
          const meta = tabMetadataCacheRef.current.get(id);
          if (meta?.url?.startsWith('http')) {
            const alreadyStashed = nextStashed.some((s) => s.url === meta.url);
            if (!alreadyStashed) {
              nextStashed.push({
                url: meta.url,
                title: meta.title || meta.url,
                favIconUrl: meta.favIconUrl,
                stashedAt: Date.now(),
              });
            }
          }
        }

        // tabIds: remove closed, add restored
        const restoredIds = restoredStashed.map((s) => liveUrlToId.get(s.url)!);
        const nextTabIds = [
          ...g.tabIds.filter((id) => liveIdSet.has(id)),
          ...restoredIds,
        ];

        // tabUrls: remove closed URLs, add restored URLs
        const closedUrls = new Set(
          closedIds
            .map((id) => tabMetadataCacheRef.current.get(id)?.url)
            .filter((u): u is string => !!u),
        );
        const nextTabUrls = [
          ...g.tabUrls.filter((u) => !closedUrls.has(u)),
          ...restoredStashed.map((s) => s.url),
        ];

        return { ...g, tabIds: nextTabIds, tabUrls: nextTabUrls, stashedTabs: nextStashed, updatedAt: Date.now() };
      });
      if (changed) void tabGroupsStorage.saveGroups(updated);
      return changed ? updated : prev;
    });
  }, []);

  // Initial load: read stored groups, sync live tabIds by URL, stash tabs not currently open
  useEffect(() => {
    void (async () => {
      const [stored, liveTabs] = await Promise.all([
        tabGroupsStorage.getGroups(),
        chrome.tabs.query({}),
      ]);
      const urlToId = new Map<string, number>();
      for (const t of liveTabs) {
        if (t.id != null && t.url) urlToId.set(t.url, t.id);
        if (t.id != null) tabMetadataCacheRef.current.set(t.id, t);
      }
      const now = Date.now();
      const synced = stored.map((g) => {
        const liveTabIds: number[] = [];
        const liveTabUrls: string[] = [];
        const stashed: StashedTab[] = [...(g.stashedTabs ?? [])];
        for (const url of g.tabUrls) {
          const id = urlToId.get(url);
          if (id != null) {
            liveTabIds.push(id);
            liveTabUrls.push(url);
          } else {
            // Tab was closed between sessions — stash with URL as title fallback
            const alreadyStashed = stashed.some((s) => s.url === url);
            if (!alreadyStashed) {
              stashed.push({ url, title: url, stashedAt: now });
            }
          }
        }
        return { ...g, tabIds: liveTabIds, tabUrls: liveTabUrls, stashedTabs: stashed };
      });
      setGroups(synced);
      setOpenTabs(liveTabs);
      void tabGroupsStorage.saveGroups(synced);
    })();
  }, []);

  // Keep live tabs in sync with Chrome events
  useEffect(() => {
    const onCreated = () => void refreshTabs();
    const onRemoved = () => void refreshTabs();
    const onUpdated = (_: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.url !== undefined || info.title !== undefined || info.status === 'complete') {
        void refreshTabs();
      }
    };
    chrome.tabs.onCreated.addListener(onCreated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onCreated.removeListener(onCreated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refreshTabs]);

  const persistGroups = useCallback(async (updated: TabGroup[]) => {
    setGroups(updated);
    await tabGroupsStorage.saveGroups(updated);
  }, []);

  const allGroupedTabIds = useMemo(
    () => new Set(groups.flatMap((g) => g.tabIds)),
    [groups],
  );

  const ungroupedTabs = useMemo(
    () => openTabs.filter((t) => t.id != null && !allGroupedTabIds.has(t.id)),
    [openTabs, allGroupedTabIds],
  );

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [groups],
  );

  // Search filtering — empty query passes everything through unchanged.
  const filteredUngroupedTabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ungroupedTabs;
    return ungroupedTabs.filter((t) => tabMatchesQuery(t.title, t.url, q));
  }, [ungroupedTabs, searchQuery]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedGroups;
    const tabsById = new Map(openTabs.filter((t) => t.id != null).map((t) => [t.id!, t]));
    return sortedGroups.filter((g) => {
      if (g.name.toLowerCase().includes(q)) return true;
      const liveMatch = g.tabIds.some((id) => {
        const t = tabsById.get(id);
        return t ? tabMatchesQuery(t.title, t.url, q) : false;
      });
      if (liveMatch) return true;
      return (g.stashedTabs ?? []).some((s) => tabMatchesQuery(s.title, s.url, q));
    });
  }, [sortedGroups, openTabs, searchQuery]);

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;
    const now = Date.now();
    const newGroup: TabGroup = {
      id: `g_${now}`,
      name: newGroupName.trim(),
      color: newGroupColor,
      pinned: false,
      context: '',
      aiContext: false,
      tabIds: [],
      tabUrls: [],
      stashedTabs: [],
      createdAt: now,
      updatedAt: now,
    };
    await persistGroups([...groups, newGroup]);
    void recentActionsStorage.addRecentAction({
      featureId: 'tabs',
      kind: 'tabs_grouped',
      label: `Created tab group: ${newGroup.name}`,
    });
    setIsCreatingGroup(false);
    setNewGroupName('');
    setNewGroupColor('primary');
    setExpandedId(newGroup.id);
  }, [newGroupName, newGroupColor, groups, persistGroups]);

  const handleRenameGroup = useCallback(
    async (id: string, name: string) => {
      await persistGroups(
        groups.map((g) => (g.id === id ? { ...g, name, updatedAt: Date.now() } : g)),
      );
    },
    [groups, persistGroups],
  );

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      await persistGroups(groups.filter((g) => g.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
    },
    [groups, persistGroups],
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      await persistGroups(
        groups.map((g) =>
          g.id === id ? { ...g, pinned: !g.pinned, updatedAt: Date.now() } : g,
        ),
      );
    },
    [groups, persistGroups],
  );

  const handleColorChange = useCallback(
    async (id: string, color: GroupColor) => {
      await persistGroups(
        groups.map((g) => (g.id === id ? { ...g, color, updatedAt: Date.now() } : g)),
      );
    },
    [groups, persistGroups],
  );

  const handleContextChange = useCallback(
    async (id: string, context: string) => {
      await persistGroups(
        groups.map((g) =>
          g.id === id ? { ...g, context, aiContext: false, updatedAt: Date.now() } : g,
        ),
      );
    },
    [groups, persistGroups],
  );

  const handleGenerateContext = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;

      const liveTabs = openTabs
        .filter((t) => t.id != null && group.tabIds.includes(t.id!))
        .map((t) => ({ title: t.title ?? 'Untitled', url: t.url ?? '' }));
      const stashed = (group.stashedTabs ?? []).map((s) => ({ title: s.title, url: s.url }));
      const allTabs = [...liveTabs, ...stashed].filter((t) => t.url.startsWith('http'));
      if (allTabs.length === 0) return;

      setGeneratingContextId(groupId);
      try {
        const summary = await aiService.summarizeTabs(allTabs);
        await persistGroups(
          groups.map((g) =>
            g.id === groupId
              ? { ...g, context: summary, aiContext: true, updatedAt: Date.now() }
              : g,
          ),
        );
      } catch {
        // silent — user can retry; spinner clears in finally
      } finally {
        setGeneratingContextId(null);
      }
    },
    [groups, openTabs, persistGroups],
  );

  const handleAddTabToGroup = useCallback(
    async (tabId: number, groupId: string) => {
      const tab = openTabs.find((t) => t.id === tabId);
      const url = tab?.url ?? '';
      const updated = groups.map((g) => {
        if (g.id === groupId) {
          if (g.tabIds.includes(tabId)) return g;
          return {
            ...g,
            tabIds: [...g.tabIds, tabId],
            tabUrls: url ? [...g.tabUrls.filter((u) => u !== url), url] : g.tabUrls,
            updatedAt: Date.now(),
          };
        }
        if (g.tabIds.includes(tabId)) {
          return {
            ...g,
            tabIds: g.tabIds.filter((id) => id !== tabId),
            tabUrls: url ? g.tabUrls.filter((u) => u !== url) : g.tabUrls,
            updatedAt: Date.now(),
          };
        }
        return g;
      });
      await persistGroups(updated);
    },
    [groups, openTabs, persistGroups],
  );

  const handleRemoveTabFromGroup = useCallback(
    async (tabId: number, groupId: string) => {
      const tab = openTabs.find((t) => t.id === tabId);
      const url = tab?.url ?? '';
      await persistGroups(
        groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                tabIds: g.tabIds.filter((id) => id !== tabId),
                tabUrls: url ? g.tabUrls.filter((u) => u !== url) : g.tabUrls,
                updatedAt: Date.now(),
              }
            : g,
        ),
      );
    },
    [groups, openTabs, persistGroups],
  );

  const handleOpenAllTabs = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      // Open only stashed (closed) tabs — live tabs are already open
      for (const s of group.stashedTabs ?? []) {
        void chrome.tabs.create({ url: s.url });
      }
    },
    [groups],
  );

  const handleReopenStashedTab = useCallback((url: string) => {
    void chrome.tabs.create({ url });
    // refreshTabs() auto-moves the URL from stashedTabs to tabIds when the tab becomes live
  }, []);

  const handleRemoveStashedTab = useCallback(
    async (url: string, groupId: string) => {
      await persistGroups(
        groups.map((g) =>
          g.id === groupId
            ? { ...g, stashedTabs: (g.stashedTabs ?? []).filter((s) => s.url !== url), updatedAt: Date.now() }
            : g,
        ),
      );
    },
    [groups, persistGroups],
  );

  const handleCloseAllTabs = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group || group.tabIds.length === 0) return;
      await chrome.tabs.remove(group.tabIds).catch(() => {});
      // refreshTabs listener will clean up tabIds automatically
    },
    [groups],
  );

  const handleCloseTab = useCallback(async (tabId: number) => {
    await chrome.tabs.remove(tabId).catch(() => {});
    // refreshTabs listener will clean up tabIds automatically
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return {
    openTabs,
    groups: filteredGroups,
    ungroupedTabs: filteredUngroupedTabs,
    expandedId,
    toggleExpanded,
    isCreatingGroup,
    setIsCreatingGroup,
    newGroupName,
    setNewGroupName,
    newGroupColor,
    setNewGroupColor,
    searchQuery,
    setSearchQuery,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleTogglePin,
    handleColorChange,
    handleContextChange,
    handleGenerateContext,
    generatingContextId,
    handleAddTabToGroup,
    handleRemoveTabFromGroup,
    handleOpenAllTabs,
    handleCloseAllTabs,
    handleCloseTab,
    handleReopenStashedTab,
    handleRemoveStashedTab,
  };
}
