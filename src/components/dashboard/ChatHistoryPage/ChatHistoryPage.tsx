/**
 * @module ChatHistoryPage
 * @description Dashboard page showing a sortable, searchable list of manually saved chat
 *   conversations across LLM platforms (ChatGPT, Claude, Gemini) with platform badges,
 *   column sorting, and click-through to the conversation detail page.
 * @dependencies useChatHistoryPage, SearchBar, @/types, @/contexts/NavigationContext
 * @public ChatHistoryPage
 */
import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  ExternalLink,
  Link2,
  Trash2,
} from 'lucide-react';
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

const MENU_WIDTH = 180;
const MENU_GAP = 4;

interface RowMenuProps {
  anchor: DOMRect;
  url: string | undefined;
  onOpenOriginal: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function RowMenu({ anchor, url, onOpenOriginal, onCopyLink, onDelete, onClose }: RowMenuProps) {
  const hasUrl = !!url;
  const top = anchor.bottom + MENU_GAP;
  const left = Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, anchor.right - MENU_WIDTH));
  return (
    <>
      <div className="chp__row-menu__backdrop" onClick={onClose} />
      <div
        className="chp__row-menu"
        role="menu"
        style={{ top, left, width: MENU_WIDTH }}
      >
        <button
          type="button"
          role="menuitem"
          className="chp__row-menu__item"
          disabled={!hasUrl}
          onClick={() => { onClose(); onOpenOriginal(); }}
        >
          <ExternalLink size={12} /> Open original
        </button>
        <button
          type="button"
          role="menuitem"
          className="chp__row-menu__item"
          disabled={!hasUrl}
          onClick={() => { onClose(); onCopyLink(); }}
        >
          <Link2 size={12} /> Copy link
        </button>
        <div className="chp__row-menu__divider" />
        <button
          type="button"
          role="menuitem"
          className="chp__row-menu__item chp__row-menu__item--danger"
          onClick={() => { onClose(); onDelete(); }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </>
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
    handleDelete,
  } = useChatHistoryPage(onOpenConversation);

  const [openMenu, setOpenMenu] = useState<{ key: string; anchor: DOMRect } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  return (
    <div className="chp">
      {/* ── Header ── */}
      <div className="chp__header">
        <div className="chp__header-left">
          <p className="chp__eyebrow">Chat History</p>
          <h1 className="chp__title">All chats</h1>
          <p className="chp__subtitle">Saved conversations across every LLM you use.</p>
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
                      <button
                        className={`chp__menu-btn${openMenu?.key === `${conv.platform}:${conv.id}` ? ' chp__menu-btn--open' : ''}`}
                        aria-label="More options"
                        aria-haspopup="menu"
                        aria-expanded={openMenu?.key === `${conv.platform}:${conv.id}`}
                        onClick={(e) => {
                          const key = `${conv.platform}:${conv.id}`;
                          if (openMenu?.key === key) {
                            setOpenMenu(null);
                          } else {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setOpenMenu({ key, anchor: rect });
                          }
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {openMenu?.key === `${conv.platform}:${conv.id}` && (
                        <RowMenu
                          anchor={openMenu.anchor}
                          url={conv.url}
                          onOpenOriginal={() => {
                            if (conv.url) window.open(conv.url, '_blank', 'noopener,noreferrer');
                          }}
                          onCopyLink={() => {
                            if (conv.url) void navigator.clipboard.writeText(conv.url);
                          }}
                          onDelete={() => void handleDelete(conv.platform, conv.id)}
                          onClose={() => setOpenMenu(null)}
                        />
                      )}
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
