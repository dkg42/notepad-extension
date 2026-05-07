/**
 * @module useChatHistoryDetailPage
 * @description Hook for the conversation detail page that fetches a full conversation
 *   (messages + meta) from the background and exposes export, copy, and delete handlers.
 * @dependencies @/types
 * @public useChatHistoryDetailPage
 */
import { useState, useEffect, useCallback } from 'react';
import type { ChatPlatform, ConversationFull } from '@/types';

export function useChatHistoryDetailPage(
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
      const res = await chrome.runtime.sendMessage({
        type: 'GET_CHAT_CONVERSATION_CONTENT',
        platform,
        id: conversationId,
      }) as { ok: boolean; conversation?: ConversationFull; error?: string };

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

  const handleExportMarkdown = useCallback(() => {
    if (!conversation) return;
    const lines: string[] = [
      `# ${conversation.meta.title}`,
      '',
      `**Platform:** ${conversation.meta.platform}`,
      `**Date:** ${new Date(conversation.meta.updatedAt).toLocaleString()}`,
      `**URL:** ${conversation.meta.url}`,
      '',
      '---',
      '',
    ];
    for (const msg of conversation.messages) {
      lines.push(`**${msg.role === 'user' ? 'You' : 'Assistant'}:**`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversation]);

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
      console.warn('[ChatHistoryDetail] Delete failed', err);
    }
  }, [platform, conversationId, onBack]);

  return {
    conversation,
    isLoading,
    error,
    handleExportMarkdown,
    handleCopy,
    handleDelete,
    handleRetry: fetchContent,
  };
}
