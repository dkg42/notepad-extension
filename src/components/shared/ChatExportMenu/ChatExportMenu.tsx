/**
 * @module ChatExportMenu
 * @description Reusable dropdown menu that exports a chat in any registered format
 *   (Markdown, Plain Text, PDF, Google Doc). Source of truth is exportStrategies, so
 *   adding a new format requires only registering a new strategy. Used by both the
 *   sidepanel chat detail view and the dashboard chat history detail page.
 * @dependencies @/export/export-registry, @/types, @/types/chat-history
 * @public ChatExportMenu
 */
import React, { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '@/types';
import type { ConversationMessage } from '@/types/chat-history';
import { exportStrategies } from '@/export/export-registry';
import './ChatExportMenu.css';

interface ChatExportMenuProps {
  messages: ConversationMessage[] | ChatMessage[];
  filename: string;
  disabled?: boolean;
  /** Optional class override applied to the trigger button so callers can match local styles. */
  buttonClassName?: string;
}

export default function ChatExportMenu({
  messages,
  filename,
  disabled,
  buttonClassName,
}: ChatExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(t);
  }, [error]);

  const handleExport = async (type: string) => {
    const strategy = exportStrategies.find((s) => s.type === type);
    if (!strategy) return;
    setBusyType(type);
    setError(null);
    try {
      await strategy.export(messages as ChatMessage[], filename);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="cem" ref={rootRef}>
      <button
        type="button"
        className={`cem__trigger${buttonClassName ? ` ${buttonClassName}` : ''}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} className="cem__chevron" />
      </button>

      {open && (
        <div className="cem__menu" role="menu">
          {exportStrategies.map((s) => (
            <button
              key={s.type}
              type="button"
              role="menuitem"
              className="cem__item"
              disabled={busyType !== null}
              onClick={() => void handleExport(s.type)}
            >
              <span className="cem__item-label">{s.label}</span>
              {busyType === s.type && <span className="cem__item-busy">…</span>}
            </button>
          ))}
          {error && <div className="cem__error">{error}</div>}
        </div>
      )}
    </div>
  );
}
