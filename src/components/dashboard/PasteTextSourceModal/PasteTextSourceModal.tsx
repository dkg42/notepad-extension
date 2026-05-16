/**
 * @module PasteTextSourceModal
 * @description Small modal for adding a pasted-text source to a NotebookLM notebook. The existing ImportSourcesModal covers URL/crawler/CSV/RSS/tabs but not raw pasted text; this fills that gap by calling the ADD_NOTEBOOK_SOURCE background message with kind="text".
 * @dependencies (none — pure presentation)
 * @public PasteTextSourceModal
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import './PasteTextSourceModal.css';

interface PasteTextSourceModalProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (title: string, content: string) => Promise<boolean>;
  onClose: () => void;
}

export default function PasteTextSourceModal({ isSubmitting, error, onSubmit, onClose }: PasteTextSourceModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    const ok = await onSubmit(title.trim() || 'Pasted text', content.trim());
    if (ok) onClose();
  }

  return (
    <div className="paste-text-source-modal__overlay" onClick={onClose}>
      <div className="paste-text-source-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paste-text-source-modal__header">
          <h2 className="paste-text-source-modal__title">Paste text as source</h2>
          <button className="paste-text-source-modal__close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="paste-text-source-modal__body">
          <label className="paste-text-source-modal__label">
            Title (optional)
            <input
              className="paste-text-source-modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Meeting notes 2026-05-15"
            />
          </label>

          <label className="paste-text-source-modal__label">
            Content
            <textarea
              className="paste-text-source-modal__textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the source content here…"
              rows={10}
              autoFocus
            />
          </label>

          {error && <div className="paste-text-source-modal__error">{error}</div>}
        </div>

        <div className="paste-text-source-modal__footer">
          <button
            className="paste-text-source-modal__btn paste-text-source-modal__btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="paste-text-source-modal__btn paste-text-source-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Adding…' : 'Add source'}
          </button>
        </div>
      </div>
    </div>
  );
}
