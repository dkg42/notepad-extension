/**
 * @module useChatHistoryPage
 * @description Hook for the Chat History dashboard page that loads conversations and sync metadata from the background, listens for real-time storage changes, and provides platform filtering, multi-field sorting, and search over conversation titles.
 * @dependencies @/types
 * @public useChatHistoryPage
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChatPlatform, ConversationMeta, ChatSyncMeta } from '@/types';

type SortField = 'updatedAt' | 'createdAt' | 'title';
type SortDir = 'asc' | 'desc';
type PlatformFilter = 'all' | ChatPlatform;

export function useChatHistoryPage(
  onOpenConversation: (platform: ChatPlatform, id: string) => void,
) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [syncMeta, setSyncMeta] = useState<ChatSyncMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [convsRes, metaRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_CHAT_CONVERSATIONS' }) as Promise<{
          ok: boolean; conversations?: ConversationMeta[]; error?: string;
        }>,
        chrome.runtime.sendMessage({ type: 'GET_CHAT_SYNC_META' }) as Promise<{
          ok: boolean; meta?: ChatSyncMeta[]; error?: string;
        }>,
      ]);

      if (convsRes?.ok && convsRes.conversations) {
        setConversations(convsRes.conversations);
      } else if (convsRes?.error) {
        setError(convsRes.error);
      }

      if (metaRes?.ok && metaRes.meta) {
        setSyncMeta(metaRes.meta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Listen for real-time storage updates from content scripts
  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('chatConversations' in changes || 'chatSyncMeta' in changes) {
        void fetchData();
      }
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
    const counts: Record<ChatPlatform, number> = { chatgpt: 0, claude: 0, gemini: 0 };
    for (const c of conversations) counts[c.platform]++;
    return counts;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let result = conversations;

    if (activePlatform !== 'all') {
      result = result.filter((c) => c.platform === activePlatform);
    }

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

  return {
    conversations: filteredConversations,
    totalCount: conversations.length,
    countByPlatform,
    syncMeta,
    isLoading,
    error,
    activePlatform,
    setActivePlatform,
    sortField,
    sortDir,
    handleSort,
    searchQuery,
    setSearchQuery,
    handleOpenConversation,
    handleRefresh: fetchData,
  };
}
