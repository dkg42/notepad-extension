/**
 * @module NotebookDetailPage
 * @description Detail view for a single NotebookLM notebook — renders sections for brief generation, sources, notes, and artifacts (audio overviews) with an audio customization dialog.
 * @dependencies ./useNotebookDetailPage, @/services/notebooklm-api, @/export/source-export-registry, @/components/dashboard/ImportSourcesModal/ImportSourcesModal, @/components/dashboard/AssignCollectionModal/AssignCollectionModal, @/contexts/NavigationContext
 * @public NotebookDetailPage
 */
import React, { useState } from 'react';
import type { AudioOverviewOptions } from '@/services/notebooklm-api';
import { useNotebookDetailPage } from './useNotebookDetailPage';
import { sourceExportStrategies } from '@/export/source-export-registry';
import ImportSourcesModal from '@/components/dashboard/ImportSourcesModal/ImportSourcesModal';
import AssignCollectionModal from '@/components/dashboard/AssignCollectionModal/AssignCollectionModal';
import { useNavigation } from '@/contexts/NavigationContext';
import './NotebookDetailPage.css';

const AUDIO_FORMATS = [
  { value: 1, label: 'Deep Dive', desc: 'A lively conversation between two hosts, unpacking and connecting topics in your sources' },
  { value: 2, label: 'Brief', desc: 'A bite-sized overview to help you grasp the core ideas from your sources quickly' },
  { value: 3, label: 'Critique', desc: 'An expert review of your sources, offering constructive feedback to help you improve your material' },
  { value: 4, label: 'Debate', desc: 'A thoughtful debate between two hosts, illuminating different perspectives on your sources' },
];

const AUDIO_LENGTHS = [
  { value: 1, label: 'Short' },
  { value: 2, label: 'Default' },
  { value: 3, label: 'Long' },
];

const AUDIO_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


export default function NotebookDetailPage() {
  const {
    selectedNotebookId: notebookId,
    handleBackToNotebooks: onBack,
    playArtifact,
    isLoadingAudio,
  } = useNavigation();

  const onPlayAudio = (mediaUrl: string, artifactId: string, title: string) =>
    void playArtifact(mediaUrl, artifactId, title);

  const {
    notebook,
    annotation,
    collections,
    isLoadingMeta,
    sources,
    isLoadingSources,
    sourcesError,
    setSourcesError,
    notes,
    isLoadingNotes,
    notesError,
    artifacts,
    isLoadingArtifacts,
    artifactsError,
    brief,
    isGeneratingBrief,
    briefError,
    isGeneratingAudio,
    audioGenerationError,
    isDeletingNotebook,
    isDeletingSource,
    isExporting,
    handleAssignCollection,
    handleCreateCollection,
    handleAddTag,
    handleRemoveTag,
    handleGenerateBrief,
    handleDeleteSource,
    handleGenerateAudio,
    handleDeleteNotebook,
    handleExportSources,
    handleRefreshAll,
  } = useNotebookDetailPage(notebookId!, onBack);

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingSourceDelete, setConfirmingSourceDelete] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Audio dialog state
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [audioFormat, setAudioFormat] = useState(1);
  const [audioLanguage, setAudioLanguage] = useState('en');
  const [audioLength, setAudioLength] = useState(2);
  const [audioFocus, setAudioFocus] = useState('');

  //── Loading ─────────────────────────────────────────────────────────────────
  if (isLoadingMeta) {
    return (
      <div className="notebook-detail">
        <div className="notebook-detail__loading">
          <span className="notebook-detail__spinner" />
          Loading notebook…
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="notebook-detail">
        <div className="notebook-detail__header">
          <button className="notebook-detail__back-btn" onClick={onBack}>
            ← Back to Notebooks
          </button>
        </div>
        <div className="notebook-detail__loading">Notebook not found.</div>
      </div>
    );
  }

  return (
    <div className="notebook-detail">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="notebook-detail__header">
        <button className="notebook-detail__back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="notebook-detail__title-group">
          <h1 className="notebook-detail__title">{notebook.title}</h1>
          <div className="notebook-detail__meta">
            Created {formatDate(notebook.createdAt)}
            {!notebook.isOwner && ' · Shared with you'}
          </div>
        </div>
        <div className="notebook-detail__header-actions">
          <a
            className="notebook-detail__external-link"
            href={notebook.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in NotebookLM ↗
          </a>
          {!confirmingDelete ? (
            <button
              className="notebook-detail__delete-btn"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete Notebook
            </button>
          ) : (
            <div className="notebook-detail__delete-confirm">
              <span>Delete permanently?</span>
              <button
                className="notebook-detail__delete-confirm-btn"
                onClick={() => void handleDeleteNotebook()}
                disabled={isDeletingNotebook}
              >
                {isDeletingNotebook ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                className="notebook-detail__delete-cancel-btn"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Collection & Tags bar ───────────────────────────────────────────── */}
      <div className="notebook-detail__meta-bar">
        {/* Collection */}
        <div className="notebook-detail__meta-item">
          <span className="notebook-detail__meta-label">Collection</span>
          <span className={`notebook-detail__collection-value${annotation.collectionId ? ' notebook-detail__collection-value--assigned' : ''}`}>
            {collections.find((c) => c.id === annotation.collectionId)?.name ?? 'None'}
          </span>
          <button
            className="notebook-detail__collection-change-btn"
            onClick={() => setShowCollectionModal(true)}
            title="Change collection"
          >
            Change
          </button>
        </div>

        {/* Tags */}
        <div className="notebook-detail__meta-item notebook-detail__meta-item--tags">
          <span className="notebook-detail__meta-label">Tags</span>
          <div className="notebook-detail__tags-row">
            {annotation.tags.map((tag) => (
              <span key={tag} className="notebook-detail__tag">
                {tag}
                <button
                  className="notebook-detail__tag-remove"
                  onClick={() => void handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            {isAddingTag ? (
              <input
                className="notebook-detail__tag-input"
                autoFocus
                placeholder="Tag name…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleAddTag(e.currentTarget.value.trim());
                    setIsAddingTag(false);
                  }
                  if (e.key === 'Escape') setIsAddingTag(false);
                }}
                onBlur={(e) => {
                  if (e.currentTarget.value.trim()) void handleAddTag(e.currentTarget.value.trim());
                  setIsAddingTag(false);
                }}
              />
            ) : (
              <button
                className="notebook-detail__add-tag-btn"
                onClick={() => setIsAddingTag(true)}
                title="Add tag"
              >
                + Add tag
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Brief section ───────────────────────────────────────────────────── */}
      <div className="notebook-detail__section">
        <div className="notebook-detail__section-header">
          <span className="notebook-detail__section-title">Brief</span>
          <button
            className="notebook-detail__action-btn"
            onClick={() => void handleGenerateBrief()}
            disabled={isGeneratingBrief}
          >
            {isGeneratingBrief ? (
              <>
                <span className="notebook-detail__spinner" />
                Generating…
              </>
            ) : brief ? (
              'Regenerate'
            ) : (
              'Generate Brief'
            )}
          </button>
        </div>
        {briefError && (
          <div className="notebook-detail__section-error">
            {briefError}
            <button
              className="notebook-detail__section-error-dismiss"
              onClick={() => void 0}
            >
              ×
            </button>
          </div>
        )}
        {brief ? (
          <div className="notebook-detail__section-body">
            <div className="notebook-detail__brief-text">{brief}</div>
          </div>
        ) : !isGeneratingBrief && !briefError ? (
          <div className="notebook-detail__section-empty">
            Click "Generate Brief" to create a summary of this notebook.
          </div>
        ) : null}
      </div>

      {/* ── Sources section ─────────────────────────────────────────────────── */}
      <div className="notebook-detail__section">
        <div className="notebook-detail__section-header">
          <span className="notebook-detail__section-title">
            Sources
            <span className="notebook-detail__section-count">({sources.length})</span>
          </span>
          <div className="notebook-detail__section-actions">
            <button
              className="notebook-detail__action-btn notebook-detail__action-btn--secondary"
              onClick={() => setShowImportModal(true)}
            >
              + Import Sources
            </button>
            <div className="notebook-detail__export-wrapper">
              <button
                className="notebook-detail__action-btn notebook-detail__action-btn--secondary"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={sources.length === 0 || isExporting}
              >
                {isExporting ? 'Exporting…' : 'Export'}
              </button>
              {showExportDropdown && (
                <div className="notebook-detail__export-dropdown">
                  {sourceExportStrategies.map((strategy) => (
                    <button
                      key={strategy.type}
                      className="notebook-detail__export-option"
                      onClick={() => {
                        setShowExportDropdown(false);
                        void handleExportSources(strategy.type);
                      }}
                    >
                      {strategy.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {sourcesError && (
          <div className="notebook-detail__section-error">
            {sourcesError}
            <button
              className="notebook-detail__section-error-dismiss"
              onClick={() => setSourcesError(null)}
            >
              ×
            </button>
          </div>
        )}
        {showImportModal && (
          <ImportSourcesModal
            notebookId={notebookId!}
            onClose={() => setShowImportModal(false)}
            onSourcesChanged={() => void handleRefreshAll()}
          />
        )}
        {isLoadingSources ? (
          <div className="notebook-detail__loading">
            <span className="notebook-detail__spinner" />
            Loading sources…
          </div>
        ) : sources.length === 0 ? (
          <div className="notebook-detail__section-empty">No sources in this notebook.</div>
        ) : (
          <div className="notebook-detail__section-body">
            {sources.map((source) => (
              <div key={source.id} className="notebook-detail__source-row">
                <span className="notebook-detail__source-type-badge">{source.type}</span>
                <span className="notebook-detail__source-title">{source.title}</span>
                <div className="notebook-detail__source-actions">
                  {confirmingSourceDelete === source.id ? (
                    <>
                      <button
                        className="notebook-detail__action-btn notebook-detail__action-btn--danger"
                        style={{ color: '#dc2626', fontWeight: 600 }}
                        onClick={() => {
                          void handleDeleteSource(source.id);
                          setConfirmingSourceDelete(null);
                        }}
                        disabled={isDeletingSource === source.id}
                      >
                        {isDeletingSource === source.id ? '…' : 'Delete'}
                      </button>
                      <button
                        className="notebook-detail__action-btn notebook-detail__action-btn--danger"
                        onClick={() => setConfirmingSourceDelete(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="notebook-detail__action-btn notebook-detail__action-btn--danger"
                      onClick={() => setConfirmingSourceDelete(source.id)}
                      title="Delete source"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notes section ───────────────────────────────────────────────────── */}
      <div className="notebook-detail__section">
        <div className="notebook-detail__section-header">
          <span className="notebook-detail__section-title">
            Notes
            <span className="notebook-detail__section-count">({notes.length})</span>
          </span>
        </div>
        {notesError && (
          <div className="notebook-detail__section-error">
            {notesError}
          </div>
        )}
        {isLoadingNotes ? (
          <div className="notebook-detail__loading">
            <span className="notebook-detail__spinner" />
            Loading notes…
          </div>
        ) : notes.length === 0 ? (
          <div className="notebook-detail__section-empty">No notes in this notebook.</div>
        ) : (
          <div className="notebook-detail__section-body">
            {notes.map((note) => (
              <div key={note.id} className="notebook-detail__note-item">
                <div
                  className="notebook-detail__note-header"
                  onClick={() =>
                    setExpandedNoteId(expandedNoteId === note.id ? null : note.id)
                  }
                >
                  <span
                    className={`notebook-detail__note-expand-icon${
                      expandedNoteId === note.id
                        ? ' notebook-detail__note-expand-icon--open'
                        : ''
                    }`}
                  >
                    ▸
                  </span>
                  <span className="notebook-detail__note-title">{note.title}</span>
                </div>
                {expandedNoteId === note.id && (
                  <div className="notebook-detail__note-content">{note.content}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Artifacts section ───────────────────────────────────────────────── */}
      <div className="notebook-detail__section">
        <div className="notebook-detail__section-header">
          <span className="notebook-detail__section-title">
            Artifacts
            <span className="notebook-detail__section-count">({artifacts.length})</span>
          </span>
          <div className="notebook-detail__section-actions">
            <button
              className="notebook-detail__action-btn"
              onClick={() => setShowAudioDialog(true)}
              disabled={isGeneratingAudio}
            >
              {isGeneratingAudio ? (
                <>
                  <span className="notebook-detail__spinner" />
                  Generating Audio…
                </>
              ) : (
                'Generate Audio'
              )}
            </button>
            <button
              className="notebook-detail__action-btn notebook-detail__action-btn--secondary"
              onClick={() => void handleRefreshAll()}
              disabled={isLoadingArtifacts}
              title="Refresh artifacts"
            >
              ↻
            </button>
          </div>
        </div>
        {audioGenerationError && (
          <div className="notebook-detail__section-error">
            {audioGenerationError}
          </div>
        )}
        {artifactsError && (
          <div className="notebook-detail__section-error">
            {artifactsError}
          </div>
        )}
        {isLoadingArtifacts ? (
          <div className="notebook-detail__loading">
            <span className="notebook-detail__spinner" />
            Loading artifacts…
          </div>
        ) : artifacts.length === 0 ? (
          <div className="notebook-detail__section-empty">
            No artifacts yet. Generate an audio overview to get started.
          </div>
        ) : (
          <div className="notebook-detail__section-body">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="notebook-detail__artifact-row">
                <span className="notebook-detail__artifact-type-badge">
                  {artifact.typeCode === 1 ? 'Audio' : `Type ${artifact.typeCode}`}
                </span>
                <span className="notebook-detail__artifact-title">{artifact.title}</span>
                {artifact.status === 1 && (
                  <span className="notebook-detail__artifact-status">Processing…</span>
                )}
                {artifact.status === 2 && (
                  <span className="notebook-detail__artifact-status">Pending…</span>
                )}
                {artifact.mediaUrl && artifact.status === 3 && (
                  <button
                    className="notebook-detail__play-btn"
                    onClick={() => onPlayAudio(artifact.mediaUrl!, artifact.id, artifact.title)}
                    disabled={isLoadingAudio}
                  >
                    {isLoadingAudio ? 'Loading…' : '▶ Play'}
                  </button>
                )}
                {!artifact.mediaUrl && artifact.status === 3 && (
                  <span className="notebook-detail__artifact-status">Completed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Audio customization dialog ──────────────────────────────────────── */}
      {showCollectionModal && (
        <AssignCollectionModal
          collections={collections}
          currentCollectionId={annotation.collectionId}
          subjectLabel={notebook.title}
          onConfirm={(collectionId) => void handleAssignCollection(collectionId)}
          onCreateCollection={handleCreateCollection}
          onClose={() => setShowCollectionModal(false)}
        />
      )}

      {showAudioDialog && (
        <div
          className="audio-dialog__overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAudioDialog(false);
          }}
        >
          <div className="audio-dialog">
            <div className="audio-dialog__header">
              <span className="audio-dialog__title">
                <span className="audio-dialog__title-icon">🎙</span>
                Customize Audio Overview
              </span>
              <button
                className="audio-dialog__close-btn"
                onClick={() => setShowAudioDialog(false)}
              >
                ✕
              </button>
            </div>
            <div className="audio-dialog__body">
              {/* Format */}
              <div>
                <div className="audio-dialog__section-label">Format</div>
                <div className="audio-dialog__format-grid">
                  {AUDIO_FORMATS.map((fmt) => (
                    <button
                      key={fmt.value}
                      className={`audio-dialog__format-tile${audioFormat === fmt.value ? ' audio-dialog__format-tile--selected' : ''}`}
                      onClick={() => setAudioFormat(fmt.value)}
                    >
                      <div className="audio-dialog__format-tile-label">
                        {fmt.label}
                        <span className="audio-dialog__format-tile-check">✓</span>
                      </div>
                      <div className="audio-dialog__format-tile-desc">{fmt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language + Length */}
              <div className="audio-dialog__options-row">
                <div>
                  <div className="audio-dialog__section-label">Choose language</div>
                  <select
                    className="audio-dialog__select-field"
                    value={audioLanguage}
                    onChange={(e) => setAudioLanguage(e.target.value)}
                  >
                    {AUDIO_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="audio-dialog__section-label">Length</div>
                  <div className="audio-dialog__length-group">
                    {AUDIO_LENGTHS.map((len) => (
                      <button
                        key={len.value}
                        className={`audio-dialog__length-btn${audioLength === len.value ? ' audio-dialog__length-btn--selected' : ''}`}
                        onClick={() => setAudioLength(len.value)}
                      >
                        {len.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus prompt */}
              <div>
                <div className="audio-dialog__section-label">
                  What should the AI hosts focus on in this episode?
                </div>
                <textarea
                  className="audio-dialog__focus-textarea"
                  placeholder="Leave blank for a general overview, or describe what you'd like the hosts to focus on…"
                  value={audioFocus}
                  onChange={(e) => setAudioFocus(e.target.value)}
                  maxLength={5000}
                />
              </div>
            </div>
            <div className="audio-dialog__footer">
              <button
                className="audio-dialog__generate-btn"
                disabled={isGeneratingAudio}
                onClick={() => {
                  const options: AudioOverviewOptions = {
                    format: audioFormat,
                    language: audioLanguage,
                    length: audioLength,
                    focus: audioFocus.trim() || undefined,
                  };
                  setShowAudioDialog(false);
                  void handleGenerateAudio(options);
                }}
              >
                {isGeneratingAudio ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
