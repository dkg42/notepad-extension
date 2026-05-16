/**
 * @module MergeNotebookModal
 * @description Modal for merging 2+ selected NotebookLM notebooks into a single new notebook. Shows the source list, lets the user choose the new notebook's title and whether to delete originals, and reports per-source copy results. Sources without a recoverable URL (pasted text, PDF, Drive) are reported as skipped so the user knows to re-attach them manually.
 * @dependencies @/types
 * @public MergeNotebookModal
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import type { NotebookMeta } from '@/types';
import './MergeNotebookModal.css';

interface MergeResult {
  copied: number;
  skipped: number;
  newNotebook: NotebookMeta;
}

interface MergeNotebookModalProps {
  selectedNotebooks: NotebookMeta[];
  onMerge: (args: {
    sourceNotebookIds: string[];
    title: string;
    deleteOriginals: boolean;
  }) => Promise<MergeResult>;
  onClose: () => void;
}

export default function MergeNotebookModal({
  selectedNotebooks,
  onMerge,
  onClose,
}: MergeNotebookModalProps) {
  const defaultTitle = `Merged: ${selectedNotebooks
    .slice(0, 2)
    .map((n) => n.title)
    .join(' + ')}${selectedNotebooks.length > 2 ? ` + ${selectedNotebooks.length - 2} more` : ''}`;

  const [title, setTitle] = useState(defaultTitle);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canMerge =
    title.trim().length > 0 && selectedNotebooks.length >= 2 && !isMerging && !result;

  async function handleMerge() {
    if (!canMerge) return;
    setIsMerging(true);
    setError(null);
    try {
      const r = await onMerge({
        sourceNotebookIds: selectedNotebooks.map((n) => n.id),
        title: title.trim(),
        deleteOriginals,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <div className="merge-notebook-modal__overlay" onClick={onClose}>
      <div className="merge-notebook-modal" onClick={(e) => e.stopPropagation()}>
        <div className="merge-notebook-modal__header">
          <h2 className="merge-notebook-modal__title">
            Merge {selectedNotebooks.length} notebooks
          </h2>
          <button className="merge-notebook-modal__close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="merge-notebook-modal__body">
          {!result ? (
            <>
              <label className="merge-notebook-modal__label">
                New notebook title
                <input
                  className="merge-notebook-modal__input"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <div className="merge-notebook-modal__list">
                <div className="merge-notebook-modal__list-label">Sources to merge:</div>
                {selectedNotebooks.map((nb) => (
                  <div key={nb.id} className="merge-notebook-modal__list-item">
                    <span className="merge-notebook-modal__list-bullet">•</span>
                    <span>{nb.title}</span>
                  </div>
                ))}
              </div>

              <label className="merge-notebook-modal__checkbox">
                <input
                  type="checkbox"
                  checked={deleteOriginals}
                  onChange={(e) => setDeleteOriginals(e.target.checked)}
                />
                <span>Delete original notebooks after merging</span>
              </label>

              <div className="merge-notebook-modal__hint">
                Only URL and YouTube sources are transferable. Pasted-text, PDF, and Google Drive
                sources will be reported as skipped — you'll need to re-attach those manually.
              </div>

              {error && <div className="merge-notebook-modal__error">{error}</div>}
            </>
          ) : (
            <div className="merge-notebook-modal__result">
              <div className="merge-notebook-modal__result-title">Merge complete</div>
              <div className="merge-notebook-modal__result-stats">
                <div>
                  <strong>{result.copied}</strong> source{result.copied === 1 ? '' : 's'} copied
                </div>
                {result.skipped > 0 && (
                  <div className="merge-notebook-modal__result-skipped">
                    <strong>{result.skipped}</strong> skipped (no recoverable URL)
                  </div>
                )}
                <div className="merge-notebook-modal__result-new">
                  New notebook: <em>{result.newNotebook.title}</em>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="merge-notebook-modal__footer">
          {!result ? (
            <>
              <button
                className="merge-notebook-modal__btn merge-notebook-modal__btn--secondary"
                onClick={onClose}
                disabled={isMerging}
              >
                Cancel
              </button>
              <button
                className="merge-notebook-modal__btn merge-notebook-modal__btn--primary"
                onClick={() => void handleMerge()}
                disabled={!canMerge}
              >
                {isMerging ? 'Merging…' : 'Merge'}
              </button>
            </>
          ) : (
            <button
              className="merge-notebook-modal__btn merge-notebook-modal__btn--primary"
              onClick={onClose}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
