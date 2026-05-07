/**
 * @module ChatHistoryPage
 * @description Dashboard page showing a sortable, searchable list of manually saved chat
 *   conversations across LLM platforms (ChatGPT, Claude, Gemini) with platform badges,
 *   column sorting, and click-through to the conversation detail page.
 * @dependencies useChatHistoryPage, SearchBar, @/types, @/contexts/NavigationContext
 * @public ChatHistoryPage
 */
import React from 'react';
import { ChevronUp, ChevronDown, Download, Plus, MoreHorizontal } from 'lucide-react';
import type { ChatPlatform } from '@/types';
import { useChatHistoryPage, formatSmartDate } from './useChatHistoryPage';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import { useNavigation } from '@/contexts/NavigationContext';
import './ChatHistoryPage.css';

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function PlatformBadge({ platform }: { platform: ChatPlatform }) {
  return (
    <span className={`chp-badge chp-badge--${platform}`}>
      <span className="chp-badge__dot" />
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
  } = useChatHistoryPage(onOpenConversation);

  return (
    <div className="chp">
      {/* ── Header ── */}
      <div className="chp__header">
        <div className="chp__header-left">
          <p className="chp__eyebrow">Chat History</p>
          <h1 className="chp__title">All chats</h1>
          <p className="chp__subtitle">Saved conversations across every LLM you use.</p>
        </div>
        <div className="chp__header-actions">
          <button className="chp__btn-ghost" onClick={handleExportAll} disabled={totalCount === 0}>
            <Download size={14} />
            Export
          </button>
          <button
            className="chp__btn-primary"
            onClick={() => void handleSaveCurrentChat()}
            disabled={isSaving}
          >
            <Plus size={14} />
            {isSaving ? 'Saving…' : 'Save current chat'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="chp__toolbar">
        <div className="chp__tabs">
          {(['all', 'chatgpt', 'claude', 'gemini'] as const).map((p) => (
            <button
              key={p}
              className={`chp__tab${activePlatform === p ? ' chp__tab--active' : ''}`}
              onClick={() => setActivePlatform(p)}
            >
              {p === 'all' ? 'All' : PLATFORM_LABELS[p]}
              <span className="chp__tab-count">
                {p === 'all' ? totalCount : countByPlatform[p]}
              </span>
            </button>
          ))}
        </div>
        <SearchBar
          className="chp__search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search messages…"
        />
      </div>

      {/* ── Content ── */}
      {isLoading && conversations.length === 0 ? (
        <div className="chp__state">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="chp__state">
          {totalCount === 0
            ? 'No saved conversations yet. Open ChatGPT, Claude, or Gemini and save a chat.'
            : 'No conversations match your search.'}
        </div>
      ) : (
        <div className="chp__table-wrapper">
          <div className="chp__table-scroll">
            <table className="chp__table">
              <thead>
                <tr>
                  <th className="chp__th chp__th--platform">Platform</th>
                  <th className="chp__th chp__th--title chp__th--sortable" onClick={() => handleSort('title')}>
                    <span className="chp__th-inner">
                      Title
                      {sortField === 'title' && (
                        sortDir === 'asc'
                          ? <ChevronUp size={11} className="chp__sort-icon" />
                          : <ChevronDown size={11} className="chp__sort-icon" />
                      )}
                    </span>
                  </th>
                  <th className="chp__th chp__th--msgs">Msgs</th>
                  <th
                    className="chp__th chp__th--updated chp__th--sortable"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <span className="chp__th-inner">
                      Updated
                      {sortField === 'updatedAt' && (
                        sortDir === 'asc'
                          ? <ChevronUp size={11} className="chp__sort-icon" />
                          : <ChevronDown size={11} className="chp__sort-icon" />
                      )}
                    </span>
                  </th>
                  <th className="chp__th chp__th--menu" />
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => (
                  <tr
                    key={`${conv.platform}:${conv.id}`}
                    className="chp__row"
                    onClick={() => handleOpenConversation(conv.platform, conv.id)}
                  >
                    <td className="chp__td chp__td--platform">
                      <PlatformBadge platform={conv.platform} />
                    </td>
                    <td className="chp__td chp__td--title">{conv.title}</td>
                    <td className="chp__td chp__td--msgs">{conv.messageCount ?? '—'}</td>
                    <td className="chp__td chp__td--updated">{formatSmartDate(conv.updatedAt)}</td>
                    <td className="chp__td chp__td--menu" onClick={(e) => e.stopPropagation()}>
                      <button className="chp__menu-btn" aria-label="More options">
                        <MoreHorizontal size={15} />
                      </button>
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
