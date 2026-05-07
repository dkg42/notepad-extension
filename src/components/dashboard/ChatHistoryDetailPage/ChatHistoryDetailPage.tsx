/**
 * @module ChatHistoryDetailPage
 * @description Detail view for a single saved conversation — renders the message thread
 *   as chat bubbles with role avatars, platform badge, and Copy/Export/Delete actions.
 * @dependencies @/types, ./useChatHistoryDetailPage, @/contexts/NavigationContext
 * @public ChatHistoryDetailPage
 */
import React from 'react';
import { ArrowLeft, Copy, Download, Trash2, ExternalLink } from 'lucide-react';
import type { ChatPlatform } from '@/types';
import { useChatHistoryDetailPage } from './useChatHistoryDetailPage';
import { useNavigation } from '@/contexts/NavigationContext';
import './ChatHistoryDetailPage.css';

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function PlatformBadge({ platform }: { platform: ChatPlatform }) {
  return (
    <span className={`chd-badge chd-badge--${platform}`}>
      <span className="chd-badge__dot" />
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export default function ChatHistoryDetailPage() {
  const {
    selectedChatPlatform: platform,
    selectedChatId: conversationId,
    handleBackToChatHistory: onBack,
  } = useNavigation();

  const {
    conversation,
    isLoading,
    error,
    handleExportMarkdown,
    handleCopy,
    handleDelete,
    handleRetry,
  } = useChatHistoryDetailPage(platform!, conversationId!, onBack);

  return (
    <div className="chd">
      {/* ── Back nav ── */}
      <button className="chd__back" onClick={onBack}>
        <ArrowLeft size={14} />
        Chat history
      </button>

      {/* ── Header ── */}
      {conversation && (
        <div className="chd__header">
          <div className="chd__header-left">
            <h1 className="chd__title">{conversation.meta.title}</h1>
            <div className="chd__meta">
              <PlatformBadge platform={platform!} />
              <span className="chd__msg-count">
                {conversation.messages.length} messages
              </span>
              {conversation.meta.url && (
                <a
                  className="chd__link"
                  href={conversation.meta.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={12} />
                  <span className="chd__link-text">{conversation.meta.url}</span>
                </a>
              )}
            </div>
          </div>
          <div className="chd__actions">
            <button className="chd__btn-ghost" onClick={() => void handleCopy()}>
              <Copy size={14} />
              Copy
            </button>
            <button className="chd__btn-ghost" onClick={handleExportMarkdown}>
              <Download size={14} />
              Export
            </button>
            <button className="chd__btn-danger" onClick={() => void handleDelete()}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── States ── */}
      {isLoading && (
        <div className="chd__state">Loading conversation…</div>
      )}

      {error && !isLoading && (
        <div className="chd__error">
          <p>{error}</p>
          <button className="chd__retry-btn" onClick={() => void handleRetry()}>
            Retry
          </button>
        </div>
      )}

      {/* ── Thread ── */}
      {conversation && !isLoading && (
        <div className="chd__thread">
          {conversation.messages.map((msg, i) => (
            <div
              key={i}
              className={`chd__msg chd__msg--${msg.role}`}
            >
              {msg.role === 'user' ? (
                <>
                  <div className="chd__msg-header chd__msg-header--user">
                    <span className="chd__msg-label">You</span>
                    {msg.createdAt && (
                      <span className="chd__msg-time">{formatTime(msg.createdAt)}</span>
                    )}
                    <span className="chd__avatar chd__avatar--user">Y</span>
                  </div>
                  <div className="chd__bubble chd__bubble--user">{msg.content}</div>
                </>
              ) : (
                <>
                  <div className="chd__msg-header chd__msg-header--assistant">
                    <span className="chd__avatar chd__avatar--assistant">*</span>
                    <span className="chd__msg-label">Assistant</span>
                    {msg.createdAt && (
                      <span className="chd__msg-time">{formatTime(msg.createdAt)}</span>
                    )}
                  </div>
                  <div className="chd__bubble chd__bubble--assistant">{msg.content}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
