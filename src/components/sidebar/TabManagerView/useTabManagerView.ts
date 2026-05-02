/**
 * @module useTabManagerView
 * @description Hook for the Tab Manager sidebar view — loads open browser tabs,
 *   persists user-defined tab groups, and provides actions for group CRUD, tab
 *   assignment, and bulk open/close. Tab IDs are synced with live tabs on every
 *   Chrome tab event; URLs are retained for cross-session restore.
 * @dependencies @/types/tab-groups, @/services/tab-groups-storage
 * @public useTabManagerView
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TabGroup, GroupColor } from '@/types/tab-groups';
import { tabGroupsStorage } from '@/services/tab-groups-storage';

export const FREE_PLAN_MAX_GROUPS = 3;
export const COLORS: GroupColor[] = ['primary', 'green', 'sky', 'rose', 'violet'];

export function useTabManagerView() {
  const [openTabs, setOpenTabs] = useState<chrome.tabs.Tab[]>([]);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<GroupColor>('primary');

  // Refresh live tabs and prune dead tabIds from all groups
  const refreshTabs = useCallback(async () => {
    const liveTabs = await chrome.tabs.query({});
    const liveIdSet = new Set(liveTabs.filter((t) => t.id != null).map((t) => t.id!));
    setOpenTabs(liveTabs);
    setGroups((prev) => {
      const updated = prev.map((g) => ({
        ...g,
        tabIds: g.tabIds.filter((id) => liveIdSet.has(id)),
      }));
      const changed = updated.some((g, i) => g.tabIds.length !== prev[i].tabIds.length);
      if (changed) void tabGroupsStorage.saveGroups(updated);
      return updated;
    });
  }, []);

  // Initial load: read stored groups, then sync live tabIds by matching stored URLs
  useEffect(() => {
    void (async () => {
      const [stored, liveTabs] = await Promise.all([
        tabGroupsStorage.getGroups(),
        chrome.tabs.query({}),
      ]);
      const urlToId = new Map<string, number>();
      for (const t of liveTabs) {
        if (t.id != null && t.url) urlToId.set(t.url, t.id);
      }
      const synced = stored.map((g) => ({
        ...g,
        tabIds: g.tabUrls
          .map((url) => urlToId.get(url))
          .filter((id): id is number => id != null),
      }));
      setGroups(synced);
      setOpenTabs(liveTabs);
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

  const atGroupLimit = groups.length >= FREE_PLAN_MAX_GROUPS;

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim() || atGroupLimit) return;
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
      createdAt: now,
      updatedAt: now,
    };
    await persistGroups([...groups, newGroup]);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setNewGroupColor('primary');
    setExpandedId(newGroup.id);
  }, [newGroupName, newGroupColor, groups, atGroupLimit, persistGroups]);

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
      for (const url of group.tabUrls) {
        void chrome.tabs.create({ url });
      }
    },
    [groups],
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
    groups: sortedGroups,
    ungroupedTabs,
    expandedId,
    toggleExpanded,
    isCreatingGroup,
    setIsCreatingGroup,
    newGroupName,
    setNewGroupName,
    newGroupColor,
    setNewGroupColor,
    atGroupLimit,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleTogglePin,
    handleColorChange,
    handleContextChange,
    handleAddTabToGroup,
    handleRemoveTabFromGroup,
    handleOpenAllTabs,
    handleCloseAllTabs,
    handleCloseTab,
  };
}
