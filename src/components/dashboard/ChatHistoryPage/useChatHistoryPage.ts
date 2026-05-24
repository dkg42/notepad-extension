/**
 * @module useChatHistoryPage
 * @description Hook for the Chat History dashboard page that loads manually saved
 *   conversations from local storage, provides platform filtering, sorting, and title search.
 * @dependencies @/types
 * @public useChatHistoryPage
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChatPlatform, ConversationMeta } from '@/types';
import { CHAT_PLATFORM_KEYS } from '@/types';

type SortField = 'updatedAt' | 'createdAt' | 'title';
type SortDir = 'asc' | 'desc';
type PlatformFilter = 'all' | ChatPlatform;

export function formatSmartDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function useChatHistoryPage(
  onOpenConversation: (platform: ChatPlatform, id: string) => void,
) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_CHAT_CONVERSATIONS' }) as {
        ok: boolean; conversations?: ConversationMeta[];
      };
      if (res?.ok && res.conversations) setConversations(res.conversations);
    } catch { /* non-fatal */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('chatConversations' in changes) void fetchData();
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, [fetchData]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const countByPlatform = useMemo(() => {
    const counts = Object.fromEntries(
      CHAT_PLATFORM_KEYS.map((k) => [k, 0]),
    ) as Record<ChatPlatform, number>;
    for (const c of conversations) counts[c.platform]++;
    return counts;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (activePlatform !== 'all') result = result.filter((c) => c.platform === activePlatform);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return result.slice().sort((a, b) => {
      if (sortField === 'title') {
        const cmp = a.title.localeCompare(b.title);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = a[sortField] - b[sortField];
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [conversations, activePlatform, searchQuery, sortField, sortDir]);

  const handleOpenConversation = useCallback(
    (platform: ChatPlatform, id: string) => onOpenConversation(platform, id),
    [onOpenConversation],
  );

  const handleDelete = useCallback(async (platform: ChatPlatform, id: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_CHAT_CONVERSATION',
        platform,
        id,
      });
    } catch (err) {
      console.warn('[ChatHistory] Delete failed', err);
    }
  }, []);

  return {
    conversations: filteredConversations,
    totalCount: conversations.length,
    countByPlatform,
    isLoading,
    activePlatform,
    setActivePlatform,
    sortField,
    sortDir,
    handleSort,
    searchQuery,
    setSearchQuery,
    handleOpenConversation,
    handleDelete,
  };
}
