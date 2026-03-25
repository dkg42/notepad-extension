import React from 'react';
import type { ChatPlatform, ChatSyncMeta } from '@/types';
import { useChatHistoryPage } from './useChatHistoryPage';
import './ChatHistoryPage.css';

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatSyncTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return formatDate(ts);
}

function PlatformBadge({ platform }: { platform: ChatPlatform }) {
  return (
    <span className={`chat-history-page__platform-badge chat-history-page__platform-badge--${platform}`}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

function SyncStatusBar({ syncMeta }: { syncMeta: ChatSyncMeta[] }) {
  const platforms: ChatPlatform[] = ['chatgpt', 'claude', 'gemini'];
  return (
    <div className="chat-history-page__sync-bar">
      {platforms.map((p) => {
        const meta = syncMeta.find((m) => m.platform === p);
        return (
          <span key={p} className="chat-history-page__sync-item">
            <PlatformBadge platform={p} />
            {meta?.error ? (
              <span className="chat-history-page__sync-error" title={meta.error}>error</span>
            ) : meta?.lastSyncedAt ? (
              <span className="chat-history-page__sync-time">synced {formatSyncTime(meta.lastSyncedAt)}</span>
            ) : (
              <span className="chat-history-page__sync-time">not synced</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface ChatHistoryPageProps {
  onOpenConversation: (platform: ChatPlatform, id: string) => void;
}

export default function ChatHistoryPage({ onOpenConversation }: ChatHistoryPageProps) {
  const {
    conversations,
    totalCount,
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
    handleRefresh,
  } = useChatHistoryPage(onOpenConversation);

  return (
    <div className="chat-history-page">
      <div className="chat-history-page__header">
        <div>
          <h1 className="chat-history-page__title">Chat History</h1>
          <p className="chat-history-page__subtitle">
            {totalCount} conversation{totalCount !== 1 ? 's' : ''} synced across all platforms
          </p>
        </div>
        <button
          className="chat-history-page__refresh-btn"
          onClick={() => void handleRefresh()}
          disabled={isLoading}
        >
          <span className={`chat-history-page__refresh-icon${isLoading ? ' chat-history-page__refresh-icon--spinning' : ''}`}>
            &#x21BB;
          </span>
          Refresh
        </button>
      </div>

      <SyncStatusBar syncMeta={syncMeta} />

      {error && (
        <div className="chat-history-page__error">
          <span>{error}</span>
          <button onClick={() => void handleRefresh()} className="chat-history-page__error-retry">
            Retry
          </button>
        </div>
      )}

      <div className="chat-history-page__toolbar">
        <div className="chat-history-page__platform-tabs">
          {(['all', 'chatgpt', 'claude', 'gemini'] as const).map((p) => (
            <button
              key={p}
              className={`chat-history-page__tab${activePlatform === p ? ' chat-history-page__tab--active' : ''}`}
              onClick={() => setActivePlatform(p)}
            >
              {p === 'all' ? 'All' : PLATFORM_LABELS[p]}
              <span className="chat-history-page__tab-count">
                {p === 'all' ? totalCount : countByPlatform[p]}
              </span>
            </button>
          ))}
        </div>

        <input
          type="search"
          className="chat-history-page__search"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading && conversations.length === 0 ? (
        <div className="chat-history-page__loading">Loading conversations...</div>
      ) : conversations.length === 0 ? (
        <div className="chat-history-page__empty">
          {totalCount === 0
            ? 'No conversations synced yet. Open ChatGPT, Claude, or Gemini to start syncing.'
            : 'No conversations match your search.'}
        </div>
      ) : (
        <table className="chat-history-page__table">
          <thead>
            <tr>
              <th
                className="chat-history-page__th chat-history-page__th--sortable"
                onClick={() => handleSort('title')}
              >
                Title
                {sortField === 'title' && (
                  <span className="chat-history-page__sort-icon">
                    {sortDir === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
              <th className="chat-history-page__th">Platform</th>
              <th
                className="chat-history-page__th chat-history-page__th--sortable"
                onClick={() => handleSort('updatedAt')}
              >
                Updated
                {sortField === 'updatedAt' && (
                  <span className="chat-history-page__sort-icon">
                    {sortDir === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
              <th className="chat-history-page__th">Messages</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conv) => (
              <tr
                key={`${conv.platform}:${conv.id}`}
                className="chat-history-page__row"
                onClick={() => handleOpenConversation(conv.platform, conv.id)}
              >
                <td className="chat-history-page__td chat-history-page__td--title">
                  {conv.title}
                </td>
                <td className="chat-history-page__td">
                  <PlatformBadge platform={conv.platform} />
                </td>
                <td className="chat-history-page__td chat-history-page__td--date">
                  {formatDate(conv.updatedAt)}
                </td>
                <td className="chat-history-page__td chat-history-page__td--count">
                  {conv.messageCount ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
