/**
 * @module ChatHistoryView
 * @description Sidebar view for chat history — shows a "Save current chat" banner when
 *   the active tab is on a supported LLM platform, a search bar, platform filter tabs,
 *   and a list of manually saved conversations.
 * @dependencies useChatHistoryView
 * @public ChatHistoryView
 */
import React, { useState } from 'react';
import { Search, Plus, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import type { ChatPlatform, ConversationMeta } from '@/types';
import { CHAT_PLATFORMS, CHAT_PLATFORM_KEYS } from '@/types';
import { useChatHistoryView } from './useChatHistoryView';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import ChatHistoryDetailView from '@/components/sidebar/ChatHistoryDetailView/ChatHistoryDetailView';
import './ChatHistoryView.css';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ChatCard({
  conv,
  onOpen,
  onOpenOriginal,
  onDelete,
}: {
  conv: ConversationMeta;
  onOpen: (conv: ConversationMeta) => void;
  onOpenOriginal: (conv: ConversationMeta) => void;
  onDelete: (conv: ConversationMeta) => void;
}) {
  const color = CHAT_PLATFORMS[conv.platform].color;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(conv);
    }
  };

  const handleOpenOriginalClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpenOriginal(conv);
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete(conv);
  };

  return (
    <div
      className="chat-history-view__card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(conv)}
      onKeyDown={handleKeyDown}
    >
      <div className="chat-history-view__card-header">
        <span className="chat-history-view__platform-dot" style={{ background: color }} />
        <span className="chat-history-view__platform-label" style={{ color }}>
          {CHAT_PLATFORMS[conv.platform].label}
        </span>
        <span className="chat-history-view__card-time">{timeAgo(conv.updatedAt)}</span>
        {conv.url && (
          <button
            className="chat-history-view__card-open"
            onClick={handleOpenOriginalClick}
            aria-label="Open original chat"
            title="Open original chat"
          >
            <ExternalLink size={12} />
          </button>
        )}
        <button
          className="chat-history-view__card-delete"
          onClick={handleDeleteClick}
          aria-label="Delete chat"
          title="Delete chat"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="chat-history-view__card-title">{conv.title}</div>
      <div className="chat-history-view__card-preview">
        {conv.messageCount != null ? `${conv.messageCount} messages` : 'No messages'}
      </div>
    </div>
  );
}

export default function ChatHistoryView() {
  const {
    currentChat,
    isAlreadySaved,
    isSaving,
    handleSave,
    conversations,
    totalCount,
    countByPlatform,
    activePlatform,
    setActivePlatform,
    searchQuery,
    setSearchQuery,
    handleDelete,
  } = useChatHistoryView();
  const { canCreate: canSave, count: saveCount } = useUsageLimit('chat_history');
  const [selected, setSelected] = useState<{ platform: ChatPlatform; id: string } | null>(null);

  const filters: Array<'all' | ChatPlatform> = ['all', ...CHAT_PLATFORM_KEYS];

  if (selected) {
    return (
      <ChatHistoryDetailView
        platform={selected.platform}
        conversationId={selected.id}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="chat-history-view">
      <div className="chat-history-view__scroll">
        {currentChat && (
          <div className="chat-history-view__banner">
            <div
              className="chat-history-view__platform-badge"
              style={{ color: CHAT_PLATFORMS[currentChat.platform].color }}
            >
              {CHAT_PLATFORMS[currentChat.platform].letter}
            </div>
            <div className="chat-history-view__banner-info">
              <div className="chat-history-view__banner-title">
                {currentChat.conversation.meta.title}
              </div>
              <div className="chat-history-view__banner-meta">
                {CHAT_PLATFORMS[currentChat.platform].label}
                {currentChat.conversation.meta.messageCount != null
                  ? ` · ${currentChat.conversation.meta.messageCount} messages`
                  : ''}
                {' · open now'}
              </div>
            </div>
            {isAlreadySaved ? (
              <button
                className="chat-history-view__resync-btn"
                onClick={() => void handleSave()}
                disabled={isSaving}
                title="Pull latest messages from this chat"
              >
                <RefreshCw size={11} strokeWidth={2.4} className={isSaving ? 'chat-history-view__resync-spin' : undefined} />
                {isSaving ? 'Syncing…' : 'Re-sync'}
              </button>
            ) : !canSave ? (
              <span className="chat-history-view__limit-badge">
                Free limit reached
              </span>
            ) : (
              <button
                className="chat-history-view__save-btn"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                <Plus size={11} strokeWidth={2.4} />
                {isSaving ? 'Saving…' : `Save${saveCount !== null ? ` (${saveCount}/5)` : ''}`}
              </button>
            )}
          </div>
        )}

        <div className="chat-history-view__search">
          <Search size={13} className="chat-history-view__search-icon" />
          <input
            placeholder="Search chats…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-history-view__filters">
          {filters.map((f) => (
            <button
              key={f}
              className={`chat-history-view__filter-btn${activePlatform === f ? ' chat-history-view__filter-btn--active' : ''}`}
              onClick={() => setActivePlatform(f)}
            >
              {f === 'all' ? `All (${totalCount})` : `${CHAT_PLATFORMS[f as ChatPlatform].label} (${countByPlatform[f as ChatPlatform]})`}
            </button>
          ))}
        </div>

        {conversations.length === 0 ? (
          <div className="chat-history-view__empty">
            {totalCount === 0
              ? 'No saved chats yet.\nOpen a chat on a supported LLM site and click Save.'
              : 'No chats match your search.'}
          </div>
        ) : (
          <div className="chat-history-view__list">
            {conversations.map((conv) => (
              <ChatCard
                key={`${conv.platform}:${conv.id}`}
                conv={conv}
                onOpen={(c) => setSelected({ platform: c.platform, id: c.id })}
                onOpenOriginal={(c) => {
                  if (c.url) window.open(c.url, '_blank', 'noopener,noreferrer');
                }}
                onDelete={(c) => void handleDelete(c.platform, c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
