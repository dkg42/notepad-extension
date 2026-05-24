/**
 * @module ChatHistoryDetailView
 * @description Sidepanel detail view for a single saved conversation — renders the message
 *   thread with role bubbles, a compact header (title, platform, message count, link to the
 *   originating site), and Copy / Export / Delete actions. Export is delegated to the
 *   shared ChatExportMenu so all registered formats are available.
 * @dependencies @/types/chat-history, ./useChatHistoryDetailView, ChatExportMenu
 * @public ChatHistoryDetailView
 */
import React from 'react';
import { ArrowLeft, Copy, Trash2, ExternalLink } from 'lucide-react';
import type { ChatPlatform } from '@/types/chat-history';
import { CHAT_PLATFORMS } from '@/types/chat-history';
import ChatExportMenu from '@/components/shared/ChatExportMenu/ChatExportMenu';
import { useChatHistoryDetailView } from './useChatHistoryDetailView';
import './ChatHistoryDetailView.css';

interface ChatHistoryDetailViewProps {
  platform: ChatPlatform;
  conversationId: string;
  onBack: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function slugify(title: string): string {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '') || 'chat';
}

export default function ChatHistoryDetailView({
  platform,
  conversationId,
  onBack,
}: ChatHistoryDetailViewProps) {
  const {
    conversation,
    isLoading,
    error,
    handleCopy,
    handleDelete,
    handleRetry,
  } = useChatHistoryDetailView(platform, conversationId, onBack);

  return (
    <div className="chdv">
      <button className="chdv__back" onClick={onBack}>
        <ArrowLeft size={13} />
        Back
      </button>

      {conversation && (
        <div className="chdv__header">
          <div className="chdv__title-row">
            <span
              className="chdv__platform-dot"
              style={{ background: CHAT_PLATFORMS[platform].color }}
            />
            <span
              className="chdv__platform-label"
              style={{ color: CHAT_PLATFORMS[platform].color }}
            >
              {CHAT_PLATFORMS[platform].label}
            </span>
            <span className="chdv__msg-count">
              · {conversation.messages.length} messages
            </span>
          </div>
          <h2 className="chdv__title">{conversation.meta.title}</h2>
          {conversation.meta.url && (
            <a
              className="chdv__link"
              href={conversation.meta.url}
              target="_blank"
              rel="noreferrer"
              title={conversation.meta.url}
            >
              <ExternalLink size={11} />
              <span className="chdv__link-text">Open original</span>
            </a>
          )}

          <div className="chdv__actions">
            <button className="chdv__btn" onClick={() => void handleCopy()}>
              <Copy size={12} />
              Copy
            </button>
            <ChatExportMenu
              messages={conversation.messages}
              filename={slugify(conversation.meta.title)}
              buttonClassName="chdv__btn"
            />
            <button
              className="chdv__btn chdv__btn--danger"
              onClick={() => void handleDelete()}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="chdv__state">Loading conversation…</div>}

      {error && !isLoading && (
        <div className="chdv__error">
          <p>{error}</p>
          <button className="chdv__retry-btn" onClick={() => void handleRetry()}>
            Retry
          </button>
        </div>
      )}

      {conversation && !isLoading && (
        <div className="chdv__thread">
          {conversation.messages.map((msg, i) => (
            <div key={i} className={`chdv__msg chdv__msg--${msg.role}`}>
              <div className="chdv__msg-header">
                <span className="chdv__msg-label">
                  {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'System'}
                </span>
                {msg.createdAt && (
                  <span className="chdv__msg-time">{formatTime(msg.createdAt)}</span>
                )}
              </div>
              <div className={`chdv__bubble chdv__bubble--${msg.role}`}>{msg.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
