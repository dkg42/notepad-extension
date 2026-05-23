/**
 * @module useChatHistoryView
 * @description Hook for the sidebar Chat History view — detects the current LLM chat,
 *   loads saved conversations, and handles the manual save action. Re-detects the current
 *   chat when the active tab changes or navigates to a different URL.
 * @dependencies @/types
 * @public useChatHistoryView
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChatPlatform, ConversationFull, ConversationMeta } from '@/types';

type PlatformFilter = 'all' | ChatPlatform;

export interface CurrentChatInfo {
  conversation: ConversationFull;
  platform: ChatPlatform;
}

export function useChatHistoryView() {
  const [currentChat, setCurrentChat] = useState<CurrentChatInfo | null>(null);
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activePlatform, setActivePlatform] = useState<PlatformFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_CHAT_CONVERSATIONS' }) as {
        ok: boolean; conversations?: ConversationMeta[];
      };
      if (res?.ok && res.conversations) setConversations(res.conversations);
    } catch { /* non-fatal */ }
  }, []);

  const fetchCurrentChat = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_CHAT_INFO' }) as {
        ok: boolean; available?: boolean; conversation?: ConversationFull;
      };
      if (res?.ok && res.available && res.conversation) {
        setCurrentChat({ conversation: res.conversation, platform: res.conversation.meta.platform });
      } else {
        setCurrentChat(null);
      }
    } catch {
      setCurrentChat(null);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    void loadConversations();
    void fetchCurrentChat();
  }, [loadConversations, fetchCurrentChat]);

  // Re-fetch current chat when the user switches to a different tab
  useEffect(() => {
    const onActivated = () => void fetchCurrentChat();
    chrome.tabs.onActivated.addListener(onActivated);
    return () => chrome.tabs.onActivated.removeListener(onActivated);
  }, [fetchCurrentChat]);

  // Re-fetch when the active tab navigates to a different URL (switching between chat sessions).
  // The content script polls the DOM until messages appear, so no artificial delay is needed here.
  useEffect(() => {
    const onUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') return;
      chrome.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => { if (tabs[0]?.id === tabId) void fetchCurrentChat(); })
        .catch(() => {});
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => chrome.tabs.onUpdated.removeListener(onUpdated);
  }, [fetchCurrentChat]);

  // Keep isAlreadySaved in sync with the conversations list
  useEffect(() => {
    if (!currentChat) { setIsAlreadySaved(false); return; }
    const key = `${currentChat.platform}:${currentChat.conversation.meta.id}`;
    setIsAlreadySaved(conversations.some((c) => `${c.platform}:${c.id}` === key));
  }, [currentChat, conversations]);

  // Listen for storage changes so the list updates after a save
  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('chatConversations' in changes) void loadConversations();
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, [loadConversations]);

  const handleDelete = useCallback(async (platform: ChatPlatform, id: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_CHAT_CONVERSATION',
        platform,
        id,
      });
      await loadConversations();
    } catch { /* non-fatal — storage listener will also refresh */ }
  }, [loadConversations]);

  const handleSave = useCallback(async () => {
    if (!currentChat || isSaving) return;
    setIsSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_CURRENT_CHAT',
        conversation: currentChat.conversation,
      });
      await loadConversations();
    } catch { /* non-fatal */ } finally {
      setIsSaving(false);
    }
  }, [currentChat, isSaving, loadConversations]);

  const filtered = useMemo(() => {
    let result = conversations;
    if (activePlatform !== 'all') result = result.filter((c) => c.platform === activePlatform);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return result;
  }, [conversations, activePlatform, searchQuery]);

  const countByPlatform = useMemo(() => {
    const counts: Record<ChatPlatform, number> = { chatgpt: 0, claude: 0, gemini: 0 };
    for (const c of conversations) counts[c.platform]++;
    return counts;
  }, [conversations]);

  return {
    currentChat,
    isAlreadySaved,
    isSaving,
    handleSave,
    handleDelete,
    conversations: filtered,
    totalCount: conversations.length,
    countByPlatform,
    activePlatform,
    setActivePlatform,
    searchQuery,
    setSearchQuery,
  };
}
