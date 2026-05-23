/**
 * @module useChatHistoryDetailView
 * @description Sidepanel hook that fetches one saved conversation's full content from the
 *   background and exposes copy/delete/retry handlers. Export is handled by the shared
 *   ChatExportMenu component, so this hook deliberately does not implement export.
 * @dependencies @/types/chat-history
 * @public useChatHistoryDetailView
 */
import { useState, useEffect, useCallback } from 'react';
import type { ChatPlatform, ConversationFull } from '@/types/chat-history';

export function useChatHistoryDetailView(
  platform: ChatPlatform,
  conversationId: string,
  onBack: () => void,
) {
  const [conversation, setConversation] = useState<ConversationFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'GET_CHAT_CONVERSATION_CONTENT',
        platform,
        id: conversationId,
      })) as { ok: boolean; conversation?: ConversationFull; error?: string };

      if (res?.ok && res.conversation) {
        setConversation(res.conversation);
      } else {
        setError(res?.error ?? 'Failed to load conversation content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [platform, conversationId]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const handleCopy = useCallback(async () => {
    if (!conversation) return;
    const lines: string[] = [conversation.meta.title, ''];
    for (const msg of conversation.messages) {
      lines.push(`${msg.role === 'user' ? 'You' : 'Assistant'}:`);
      lines.push(msg.content);
      lines.push('');
    }
    await navigator.clipboard.writeText(lines.join('\n'));
  }, [conversation]);

  const handleDelete = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_CHAT_CONVERSATION',
        platform,
        id: conversationId,
      });
      onBack();
    } catch (err) {
      console.warn('[ChatHistoryDetailView] Delete failed', err);
    }
  }, [platform, conversationId, onBack]);

  return {
    conversation,
    isLoading,
    error,
    handleCopy,
    handleDelete,
    handleRetry: fetchContent,
  };
}
