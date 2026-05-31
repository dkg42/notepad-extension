/**
 * @module SnippetsView
 * @description Clipboard-history view inside the sidebar, displaying up to 50 recent copies with type badges (text, image, url, code), relative timestamps, and per-entry copy/save/delete actions. Includes a usage bar tracking capacity.
 * @dependencies @/types
 * @public SnippetsView (default export)
 */
import React from 'react';
import { Trash2, Copy, Bookmark } from 'lucide-react';
import type { ClipboardEntry } from '@/types';
import { recentActionsStorage } from '@/services/storage/recent-actions-storage';
import './SnippetsView.css';

const MAX_SNIPPETS = 50;

const KIND_STYLES: Record<string, { bg: string; fg: string }> = {
  text:  { bg: 'var(--tag-1-bg)', fg: 'var(--tag-1-fg)' },
  image: { bg: 'var(--tag-3-bg)', fg: 'var(--tag-3-fg)' },
  url:   { bg: 'var(--tag-5-bg)', fg: 'var(--tag-5-fg)' },
  code:  { bg: 'var(--tag-3-bg)', fg: 'var(--tag-3-fg)' },
};

function getKind(entry: ClipboardEntry): string {
  if (entry.type === 'image') return 'image';
  const text = entry.text ?? '';
  if (/^https?:\/\//i.test(text.trim())) return 'url';
  if (text.includes('\n') && (text.includes('{') || text.includes('def ') || text.includes('const '))) return 'code';
  return 'text';
}

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

interface SnippetsViewProps {
  entries: ClipboardEntry[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onCopyText: (text: string) => void;
  onSaveAsSnippet: (entry: ClipboardEntry) => void;
}

function UsageBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100);
  return (
    <div className="snippets-view__usage-bar-row">
      <div className="snippets-view__usage-track">
        <div
          className={`snippets-view__usage-fill${pct >= 80 ? ' snippets-view__usage-fill--warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SnippetsView({
  entries,
  onDelete,
  onClear,
  onCopyText,
  onSaveAsSnippet,
}: SnippetsViewProps) {
  return (
    <div className="snippets-view">
      <div className="snippets-view__banner">
        <span className="snippets-view__banner-text">
          {entries.length} of {MAX_SNIPPETS} snippets
        </span>
        <div className="snippets-view__banner-bar">
          <UsageBar used={entries.length} max={MAX_SNIPPETS} />
        </div>
        <span className="snippets-view__banner-spacer" />
        {entries.length > 0 && (
          <button className="snippets-view__banner-btn" onClick={onClear}>
            <Trash2 size={11} />
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="snippets-view__empty">
          Nothing copied yet. Copies from AI chat pages appear here.
        </div>
      ) : (
        <div className="snippets-view__list">
          {entries.map((entry) => {
            const kind = getKind(entry);
            const kindStyle = KIND_STYLES[kind] ?? KIND_STYLES.text;
            const isMono = kind === 'url' || kind === 'code';

            return (
              <div key={entry.id} className="snippets-view__item">
                <div className="snippets-view__item-meta">
                  <span
                    className="snippets-view__kind-badge"
                    style={{ background: kindStyle.bg, color: kindStyle.fg }}
                  >
                    {kind}
                  </span>
                  <span className="snippets-view__item-source">
                    {getHostname(entry.source)}
                  </span>
                  <span className="snippets-view__item-spacer" />
                  <span className="snippets-view__item-time">
                    {formatTime(entry.copiedAt)}
                  </span>
                </div>

                {entry.type === 'image' && entry.thumbnailDataUrl ? (
                  <img
                    src={entry.thumbnailDataUrl}
                    alt="Copied image"
                    className="snippets-view__item-image"
                  />
                ) : (
                  <div className={`snippets-view__item-text${isMono ? ' snippets-view__item-text--mono' : ''}`}>
                    {entry.text}
                  </div>
                )}

                <div className="snippets-view__item-actions">
                  {entry.type === 'text' && (
                    <>
                      <button
                        className="snippets-view__action-btn"
                        onClick={() => {
                          if (!entry.text) return;
                          onCopyText(entry.text);
                          void recentActionsStorage.addRecentAction({
                            featureId: 'snippets',
                            kind: 'snippet_copied',
                            label: `Copied snippet: ${entry.text.slice(0, 40).replace(/\s+/g, ' ').trim()}`,
                          });
                        }}
                      >
                        <Copy size={10} />
                        Copy
                      </button>
                      <button
                        className="snippets-view__action-btn"
                        onClick={() => onSaveAsSnippet(entry)}
                      >
                        <Bookmark size={10} />
                        Save
                      </button>
                    </>
                  )}
                  <button
                    className="snippets-view__action-btn snippets-view__action-btn--danger"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 size={10} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
