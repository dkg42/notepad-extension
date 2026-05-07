/**
 * @module useChatHistoryPage
 * @description Hook for the Chat History dashboard page that loads manually saved
 *   conversations from local storage, provides platform filtering, sorting, and title search.
 * @dependencies @/types
 * @public useChatHistoryPage
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChatPlatform, ConversationFull, ConversationMeta } from '@/types';

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
  const [isSaving, setIsSaving] = useState(false);
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
    const counts: Record<ChatPlatform, number> = { chatgpt: 0, claude: 0, gemini: 0 };
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

  const handleSaveCurrentChat = useCallback(async () => {
    setIsSaving(true);
    try {
      const infoRes = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_CHAT_INFO' }) as {
        ok: boolean; available?: boolean; conversation?: ConversationFull;
      };
      if (!infoRes?.ok || !infoRes.available || !infoRes.conversation) {
        console.warn('[ChatHistory] No active LLM tab to save');
        return;
      }
      await chrome.runtime.sendMessage({ type: 'SAVE_CURRENT_CHAT', conversation: infoRes.conversation });
    } catch (err) {
      console.warn('[ChatHistory] Save current chat failed', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleExportAll = useCallback(() => {
    if (conversations.length === 0) return;
    const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notehublm-chats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversations]);

  return {
    conversations: filteredConversations,
    totalCount: conversations.length,
    countByPlatform,
    isLoading,
    isSaving,
    activePlatform,
    setActivePlatform,
    sortField,
    sortDir,
    handleSort,
    searchQuery,
    setSearchQuery,
    handleOpenConversation,
    handleSaveCurrentChat,
    handleExportAll,
  };
}
