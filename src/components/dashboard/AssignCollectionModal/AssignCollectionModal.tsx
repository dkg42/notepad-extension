/**
 * @module AssignCollectionModal
 * @description Renders a modal dialog for assigning one or more notebooks to an existing collection or creating a new collection inline before confirming.
 * @dependencies @/types (NotebookCollection)
 * @public AssignCollectionModal
 */
import React, { useState } from 'react';
import type { NotebookCollection } from '@/types';
import './AssignCollectionModal.css';

interface AssignCollectionModalProps {
  collections: NotebookCollection[];
  /** The collectionId shared by all selected notebooks, or undefined if mixed/none. */
  currentCollectionId: string | undefined;
  /** Label shown in the subtitle (e.g. "3 notebooks" or a single notebook title). */
  subjectLabel: string;
  onConfirm: (collectionId: string | undefined) => void;
  onCreateCollection: (name: string) => Promise<string>;
  onClose: () => void;
}

export default function AssignCollectionModal({
  collections,
  currentCollectionId,
  subjectLabel,
  onConfirm,
  onCreateCollection,
  onClose,
}: AssignCollectionModalProps) {
  const [selected, setSelected] = useState<string | undefined>(currentCollectionId);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    onConfirm(selected);
    onClose();
  }

  async function handleCreateAndSelect() {
    const name = newName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const id = await onCreateCollection(name);
      setSelected(id);
    } finally {
      setIsSubmitting(false);
      setNewName('');
      setIsCreating(false);
    }
  }

  return (
    <div
      className="assign-collection-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="assign-collection-modal" role="dialog" aria-modal="true">
        <div className="assign-collection-modal__header">
          <h2 className="assign-collection-modal__title">Assign to Collection</h2>
          <button
            className="assign-collection-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="assign-collection-modal__subtitle">
          Select a collection for <strong>{subjectLabel}</strong>:
        </p>

        <div className="assign-collection-modal__list">
          {/* None option */}
          <label className={`assign-collection-modal__option${selected === undefined ? ' assign-collection-modal__option--selected' : ''}`}>
            <input
              type="radio"
              name="collection"
              checked={selected === undefined}
              onChange={() => setSelected(undefined)}
            />
            <span className="assign-collection-modal__option-label">None</span>
            <span className="assign-collection-modal__option-hint">Remove from any collection</span>
          </label>

          {collections.map((col) => (
            <label
              key={col.id}
              className={`assign-collection-modal__option${selected === col.id ? ' assign-collection-modal__option--selected' : ''}`}
            >
              <input
                type="radio"
                name="collection"
                checked={selected === col.id}
                onChange={() => setSelected(col.id)}
              />
              <span className="assign-collection-modal__option-label">{col.name}</span>
            </label>
          ))}
        </div>

        {/* New collection inline creator */}
        <div className="assign-collection-modal__new">
          {isCreating ? (
            <div className="assign-collection-modal__new-row">
              <input
                className="assign-collection-modal__new-input"
                autoFocus
                placeholder="Collection name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateAndSelect();
                  if (e.key === 'Escape') {
                    setNewName('');
                    setIsCreating(false);
                  }
                }}
                disabled={isSubmitting}
              />
              <button
                className="assign-collection-modal__new-confirm"
                onClick={() => void handleCreateAndSelect()}
                disabled={!newName.trim() || isSubmitting}
              >
                Create
              </button>
              <button
                className="assign-collection-modal__new-cancel"
                onClick={() => {
                  setNewName('');
                  setIsCreating(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="assign-collection-modal__new-btn"
              onClick={() => setIsCreating(true)}
            >
              + New collection
            </button>
          )}
        </div>

        <div className="assign-collection-modal__footer">
          <button
            className="assign-collection-modal__cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="assign-collection-modal__confirm-btn"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || selected === currentCollectionId}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
