import React from 'react';
import type { ChatPlatform } from '@/types';
import { useChatHistoryDetailPage } from './useChatHistoryDetailPage';
import './ChatHistoryDetailPage.css';

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface ChatHistoryDetailPageProps {
  platform: ChatPlatform;
  conversationId: string;
  onBack: () => void;
}

export default function ChatHistoryDetailPage({
  platform,
  conversationId,
  onBack,
}: ChatHistoryDetailPageProps) {
  const {
    conversation,
    isLoading,
    error,
    handleExportMarkdown,
    handleExportJson,
    handleRetry,
  } = useChatHistoryDetailPage(platform, conversationId);

  return (
    <div className="chat-history-detail">
      <div className="chat-history-detail__header">
        <button className="chat-history-detail__back-btn" onClick={onBack}>
          &#x2190; Back
        </button>

        {conversation && (
          <div className="chat-history-detail__meta">
            <h1 className="chat-history-detail__title">{conversation.meta.title}</h1>
            <div className="chat-history-detail__info">
              <span className={`chat-history-detail__platform-badge chat-history-detail__platform-badge--${platform}`}>
                {PLATFORM_LABELS[platform]}
              </span>
              <span className="chat-history-detail__date">
                Updated {formatDate(conversation.meta.updatedAt)}
              </span>
              <a
                className="chat-history-detail__open-link"
                href={conversation.meta.url}
                target="_blank"
                rel="noreferrer"
              >
                Open in {PLATFORM_LABELS[platform]} &#x2197;
              </a>
            </div>
          </div>
        )}

        {conversation && (
          <div className="chat-history-detail__actions">
            <button className="chat-history-detail__export-btn" onClick={handleExportMarkdown}>
              Export MD
            </button>
            <button className="chat-history-detail__export-btn" onClick={handleExportJson}>
              Export JSON
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="chat-history-detail__loading">Loading conversation...</div>
      )}

      {error && !isLoading && (
        <div className="chat-history-detail__error">
          <p>{error}</p>
          <button className="chat-history-detail__retry-btn" onClick={() => void handleRetry()}>
            Retry
          </button>
        </div>
      )}

      {conversation && !isLoading && (
        <div className="chat-history-detail__thread">
          {conversation.messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-history-detail__message chat-history-detail__message--${msg.role}`}
            >
              <div className="chat-history-detail__message-label">
                {msg.role === 'user' ? 'You' : PLATFORM_LABELS[platform]}
              </div>
              <div className="chat-history-detail__message-content">{msg.content}</div>
              {msg.createdAt && (
                <div className="chat-history-detail__message-time">
                  {formatDate(msg.createdAt)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
