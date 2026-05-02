/**
 * @module ChatHistoryPage
 * @description Dashboard page showing a sortable, searchable list of manually saved chat
 *   conversations across LLM platforms (ChatGPT, Claude, Gemini) with platform badges,
 *   column sorting, and click-through to the conversation detail page.
 * @dependencies useChatHistoryPage, SearchBar, @/types, @/contexts/NavigationContext
 * @public ChatHistoryPage
 */
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { ChatPlatform } from '@/types';
import { useChatHistoryPage } from './useChatHistoryPage';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import { useNavigation } from '@/contexts/NavigationContext';
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

function PlatformBadge({ platform }: { platform: ChatPlatform }) {
  return (
    <span className={`chat-history-page__platform-badge chat-history-page__platform-badge--${platform}`}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export default function ChatHistoryPage() {
  const { handleOpenChatDetail: onOpenConversation } = useNavigation();

  const {
    conversations,
    totalCount,
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
  } = useChatHistoryPage(onOpenConversation);

  return (
    <div className="chat-history-page">
      <div className="chat-history-page__header">
        <div>
          <h1 className="chat-history-page__title">Chat History</h1>
          <p className="chat-history-page__subtitle">
            {totalCount} saved conversation{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

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

        <SearchBar
          className="chat-history-page__search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search conversations…"
        />
      </div>

      {isLoading && conversations.length === 0 ? (
        <div className="chat-history-page__loading">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="chat-history-page__empty">
          {totalCount === 0
            ? 'No saved conversations yet. Open ChatGPT, Claude, or Gemini and use the sidebar to save a chat.'
            : 'No conversations match your search.'}
        </div>
      ) : (
        <div className="chat-history-page__table-wrapper">
          <div className="chat-history-page__table-scroll">
            <table className="chat-history-page__table">
              <thead>
                <tr>
                  <th
                    className="chat-history-page__th chat-history-page__th--sortable"
                    onClick={() => handleSort('title')}
                  >
                    <span className="chat-history-page__th-content">
                      Title
                      {sortField === 'title'
                        ? (sortDir === 'asc'
                          ? <ChevronUp size={11} className="chat-history-page__sort-icon chat-history-page__sort-icon--active" />
                          : <ChevronDown size={11} className="chat-history-page__sort-icon chat-history-page__sort-icon--active" />)
                        : null}
                    </span>
                  </th>
                  <th className="chat-history-page__th">Platform</th>
                  <th
                    className="chat-history-page__th chat-history-page__th--sortable"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <span className="chat-history-page__th-content">
                      Saved
                      {sortField === 'updatedAt'
                        ? (sortDir === 'asc'
                          ? <ChevronUp size={11} className="chat-history-page__sort-icon chat-history-page__sort-icon--active" />
                          : <ChevronDown size={11} className="chat-history-page__sort-icon chat-history-page__sort-icon--active" />)
                        : null}
                    </span>
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
          </div>
        </div>
      )}
    </div>
  );
}
