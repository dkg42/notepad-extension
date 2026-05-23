/**
 * @module ChatHistoryView
 * @description Sidebar view for chat history — shows a "Save current chat" banner when
 *   the active tab is on a supported LLM platform, a search bar, platform filter tabs,
 *   and a list of manually saved conversations.
 * @dependencies useChatHistoryView
 * @public ChatHistoryView
 */
import React from 'react';
import { Search, Plus, Check } from 'lucide-react';
import type { ChatPlatform, ConversationMeta } from '@/types';
import { useChatHistoryView } from './useChatHistoryView';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import './ChatHistoryView.css';

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

const PLATFORM_LETTER: Record<ChatPlatform, string> = {
  chatgpt: 'G',
  claude: 'C',
  gemini: 'Gem',
};

const PLATFORM_COLOR: Record<ChatPlatform, string> = {
  chatgpt: 'oklch(0.65 0.15 160)',
  claude: 'oklch(0.62 0.16 35)',
  gemini: 'oklch(0.62 0.18 270)',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ChatCard({ conv }: { conv: ConversationMeta }) {
  const color = PLATFORM_COLOR[conv.platform];

  const handleClick = () => {
    chrome.tabs.create({ url: conv.url });
  };

  return (
    <button className="chat-history-view__card" onClick={handleClick}>
      <div className="chat-history-view__card-header">
        <span className="chat-history-view__platform-dot" style={{ background: color }} />
        <span className="chat-history-view__platform-label" style={{ color }}>
          {PLATFORM_LABELS[conv.platform]}
        </span>
        <span className="chat-history-view__card-time">{timeAgo(conv.updatedAt)}</span>
      </div>
      <div className="chat-history-view__card-title">{conv.title}</div>
      <div className="chat-history-view__card-preview">
        {conv.messageCount != null ? `${conv.messageCount} messages` : 'No messages'}
      </div>
    </button>
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
  } = useChatHistoryView();
  const { canCreate: canSave, count: saveCount } = useUsageLimit('chat_history');

  const filters: Array<'all' | ChatPlatform> = ['all', 'chatgpt', 'claude', 'gemini'];

  return (
    <div className="chat-history-view">
      <div className="chat-history-view__scroll">
        {currentChat && (
          <div className="chat-history-view__banner">
            <div
              className="chat-history-view__platform-badge"
              style={{ color: PLATFORM_COLOR[currentChat.platform] }}
            >
              {PLATFORM_LETTER[currentChat.platform]}
            </div>
            <div className="chat-history-view__banner-info">
              <div className="chat-history-view__banner-title">
                {currentChat.conversation.meta.title}
              </div>
              <div className="chat-history-view__banner-meta">
                {PLATFORM_LABELS[currentChat.platform]}
                {currentChat.conversation.meta.messageCount != null
                  ? ` · ${currentChat.conversation.meta.messageCount} messages`
                  : ''}
                {' · open now'}
              </div>
            </div>
            {isAlreadySaved ? (
              <span className="chat-history-view__saved-badge">
                <Check size={11} />
                Saved
              </span>
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
              {f === 'all' ? `All (${totalCount})` : `${PLATFORM_LABELS[f as ChatPlatform]} (${countByPlatform[f as ChatPlatform]})`}
            </button>
          ))}
        </div>

        {conversations.length === 0 ? (
          <div className="chat-history-view__empty">
            {totalCount === 0
              ? 'No saved chats yet.\nOpen a chat on ChatGPT, Claude, or Gemini and click Save.'
              : 'No chats match your search.'}
          </div>
        ) : (
          <div className="chat-history-view__list">
            {conversations.map((conv) => (
              <ChatCard key={`${conv.platform}:${conv.id}`} conv={conv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
