/**
 * @module NewNotebookModal
 * @description Modal for creating a new NotebookLM notebook from the dashboard. Lets the user enter a title and (optionally) attach one initial source as either a URL/YouTube link or pasted text. Calls back to the page hook to perform the create + add-source background RPCs and surfaces inline errors.
 * @dependencies @/types
 * @public NewNotebookModal
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import type { NotebookMeta } from '@/types';
import './NewNotebookModal.css';

type SourceKind = 'none' | 'url' | 'text';

interface NewNotebookModalProps {
  /** Called when the user submits. Resolves with the new notebook so the page can navigate to it (optional). */
  onCreate: (args: {
    title: string;
    initialSource?:
      | { kind: 'url'; url: string }
      | { kind: 'text'; title: string; content: string };
  }) => Promise<NotebookMeta>;
  onClose: () => void;
}

export default function NewNotebookModal({ onCreate, onClose }: NewNotebookModalProps) {
  const [title, setTitle] = useState('');
  const [sourceKind, setSourceKind] = useState<SourceKind>('none');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleTrimmed = title.trim();
  const canSubmit =
    titleTrimmed.length > 0 &&
    !isSubmitting &&
    (sourceKind === 'none' ||
      (sourceKind === 'url' && sourceUrl.trim().length > 0) ||
      (sourceKind === 'text' && sourceContent.trim().length > 0));

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let initialSource: Parameters<typeof onCreate>[0]['initialSource'];
      if (sourceKind === 'url') {
        initialSource = { kind: 'url', url: sourceUrl.trim() };
      } else if (sourceKind === 'text') {
        initialSource = {
          kind: 'text',
          title: sourceTitle.trim() || 'Pasted text',
          content: sourceContent.trim(),
        };
      }
      await onCreate({ title: titleTrimmed, initialSource });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notebook');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="new-notebook-modal__overlay" onClick={onClose}>
      <div className="new-notebook-modal" onClick={(e) => e.stopPropagation()}>
        <div className="new-notebook-modal__header">
          <h2 className="new-notebook-modal__title">New notebook</h2>
          <button className="new-notebook-modal__close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="new-notebook-modal__body">
          <label className="new-notebook-modal__label">
            Title
            <input
              className="new-notebook-modal__input"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 product research"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) void handleSubmit();
              }}
            />
          </label>

          <fieldset className="new-notebook-modal__fieldset">
            <legend className="new-notebook-modal__legend">Initial source (optional)</legend>
            <div className="new-notebook-modal__radio-row">
              {(['none', 'url', 'text'] as const).map((kind) => (
                <label key={kind} className="new-notebook-modal__radio">
                  <input
                    type="radio"
                    name="source-kind"
                    checked={sourceKind === kind}
                    onChange={() => setSourceKind(kind)}
                  />
                  <span>
                    {kind === 'none' ? 'None' : kind === 'url' ? 'URL / YouTube' : 'Paste text'}
                  </span>
                </label>
              ))}
            </div>

            {sourceKind === 'url' && (
              <input
                className="new-notebook-modal__input"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
              />
            )}

            {sourceKind === 'text' && (
              <>
                <input
                  className="new-notebook-modal__input"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="Source title (optional)"
                />
                <textarea
                  className="new-notebook-modal__textarea"
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="Paste source content here…"
                  rows={6}
                />
              </>
            )}
          </fieldset>

          {error && <div className="new-notebook-modal__error">{error}</div>}
        </div>

        <div className="new-notebook-modal__footer">
          <button
            className="new-notebook-modal__btn new-notebook-modal__btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="new-notebook-modal__btn new-notebook-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
