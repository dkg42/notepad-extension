/**
 * @module NotebooksPage
 * @description Page listing synced Google NotebookLM notebooks with a two-panel nested folder layout. Left panel: collapsible folder tree with count badges and sync footer. Right panel: breadcrumb + title row + toolbar + context-sensitive content (subfolder cards, grouped list, or flat table).
 * @dependencies ./useNotebooksPage, @/export/source-export-registry, @/components/dashboard/NotebookFolderModal/NotebookFolderModal, @/components/dashboard/FolderTree/FolderTree, @/components/dashboard/MoveFolderDialog/MoveFolderDialog, @/contexts/NavigationContext, @/utils/folder-utils
 * @public NotebooksPage
 */
import React, { useRef, useState, useMemo } from 'react';
import { BookOpen, ExternalLink, Loader2, Folder, FolderOpen, ChevronRight, RefreshCw, Search, X, Layers, MoreHorizontal, Plus, GitMerge } from 'lucide-react';
import { useNotebooksPage, UNFILED_FILTER_ID } from './useNotebooksPage';
import { sourceExportStrategies } from '@/export/source-export-registry';
import NotebookFolderModal from '@/components/dashboard/NotebookFolderModal/NotebookFolderModal';
import FolderTree from '@/components/dashboard/FolderTree/FolderTree';
import MoveFolderDialog from '@/components/dashboard/MoveFolderDialog/MoveFolderDialog';
import NewNotebookModal from '@/components/dashboard/NewNotebookModal/NewNotebookModal';
import MergeNotebookModal from '@/components/dashboard/MergeNotebookModal/MergeNotebookModal';
import { useNavigation } from '@/contexts/NavigationContext';
import { getFolderSubtreeIds } from '@/utils/folder-utils';
import type { Folder as FolderType, NotebookMeta, NotebookAnnotation } from '@/types';
import './NotebooksPage.css';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getBreadcrumb(folderId: string | null, folders: FolderType[]): FolderType[] {
  if (!folderId || folderId === UNFILED_FILTER_ID) return [];
  const path: FolderType[] = [];
  let cur = folders.find((f) => f.id === folderId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return path;
}

// ── Notebook row ─────────────────────────────────────────────────────────────

interface NbRowProps {
  notebook: NotebookMeta;
  annotation: NotebookAnnotation;
  isLast: boolean;
  selected: boolean;
  onToggleSel: () => void;
  onOpenDetail: () => void;
  showFolderPath: boolean;
  folderPath: string | null;
  sourceCounts: Record<string, number>;
  fetchingSourcesId: string | null;
  exportingId: string | null;
  onToggleExport: () => void;
  onExport: (strategyType: string) => void;
  taggingId: string | null;
  onStartTag: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onStopTag: () => void;
  confirmingDeleteId: string | null;
  deletingId: string | null;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  compact: boolean;
  rowMenuOpen: boolean;
  onToggleRowMenu: () => void;
  onCloseRowMenu: () => void;
  onMoveToFolder: () => void;
}

function NbRow({
  notebook, annotation, isLast, selected, onToggleSel, onOpenDetail,
  showFolderPath, folderPath,
  sourceCounts, fetchingSourcesId, exportingId, onToggleExport, onExport,
  taggingId, onStartTag, onAddTag, onRemoveTag, onStopTag,
  confirmingDeleteId, deletingId, onStartDelete, onConfirmDelete, onCancelDelete,
  compact, rowMenuOpen, onToggleRowMenu, onCloseRowMenu, onMoveToFolder,
}: NbRowProps) {
  const rowPad = compact ? '8px 14px' : '10px 14px';

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) onAddTag(val);
      onStopTag();
    }
    if (e.key === 'Escape') onStopTag();
  }

  function handleTagBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.trim();
    if (val) onAddTag(val);
    onStopTag();
  }

  return (
    <div
      className={`nb-row${selected ? ' nb-row--selected' : ''}`}
      style={{ padding: rowPad, borderBottom: isLast ? 'none' : '1px solid var(--line)' }}
    >
      {/* Select */}
      <div className="nb-row__select">
        <input
          type="checkbox"
          className="notebooks-checkbox"
          checked={selected}
          onChange={onToggleSel}
        />
      </div>

      {/* Title */}
      <div className="nb-row__title-cell" onClick={onOpenDetail}>
        <div className="nb-notebook-icon-bg">
          <BookOpen size={14} strokeWidth={1.75} />
        </div>
        <div className="nb-row__title-text">
          <div className="nb-row__title-name">
            {notebook.title}
            {!notebook.isOwner && (
              <span className="notebooks-table__badge">Shared</span>
            )}
            <a
              className="notebooks-table__external-link"
              href={notebook.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in NotebookLM"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} strokeWidth={1.75} />
            </a>
          </div>
          {showFolderPath && folderPath && (
            <div className="nb-notebook-folder-path">
              <Folder size={9} strokeWidth={1.7} />
              {folderPath}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="nb-row__tags">
        <div className="notebooks-tags-cell">
          {annotation.tags.map((tag) => (
            <span key={tag} className="notebook-tag">
              <span className="notebook-tag__label">{tag}</span>
              <button
                className="notebook-tag__remove"
                onClick={() => onRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                &#x2715;
              </button>
            </span>
          ))}
          {taggingId === notebook.id ? (
            <input
              className="notebook-tag-input"
              autoFocus
              placeholder="Tag name…"
              onKeyDown={handleTagKeyDown}
              onBlur={handleTagBlur}
            />
          ) : (
            <button
              className="notebooks-add-tag-btn"
              onClick={onStartTag}
              title="Add tag"
              aria-label="Add tag"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Sources */}
      <div className="nb-row__sources">
        {fetchingSourcesId === notebook.id || fetchingSourcesId === '__all__' ? (
          <span className="notebooks-table__sources-loading" aria-label="Fetching sources…">
            <Loader2 size={13} strokeWidth={1.75} />
          </span>
        ) : (
          <div className="notebooks-sources-cell">
            <span className="notebooks-sources-count">
              {sourceCounts[notebook.id] !== undefined ? sourceCounts[notebook.id] : '—'}
            </span>
            <button
              className="notebooks-sources-download-btn"
              onClick={(e) => { e.stopPropagation(); onToggleExport(); }}
              title="Export sources"
            >
              <ExternalLink size={11} strokeWidth={1.75} />
            </button>
            {exportingId === notebook.id && (
              <div className="notebooks-sources-format-menu">
                {sourceExportStrategies.map((s) => (
                  <button
                    key={s.type}
                    className="notebooks-sources-format-item"
                    onClick={() => onExport(s.type)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last synced */}
      <div className="nb-row__synced">
        {formatRelativeTime(notebook.lastSyncedAt)}
      </div>

      {/* More / delete */}
      <div className="nb-row__more" onClick={(e) => e.stopPropagation()}>
        {deletingId === notebook.id ? (
          <span className="notebooks-table__deleting" aria-label="Deleting…">&#x231B;</span>
        ) : confirmingDeleteId === notebook.id ? (
          <span className="notebooks-table__confirm-delete">
            <span className="notebooks-table__confirm-label">Delete?</span>
            <button
              className="notebooks-table__confirm-btn notebooks-table__confirm-btn--yes"
              onClick={onConfirmDelete}
            >&#x2713;</button>
            <button
              className="notebooks-table__confirm-btn notebooks-table__confirm-btn--no"
              onClick={onCancelDelete}
            >&#x2715;</button>
          </span>
        ) : (
          <div className="nb-row-menu-wrap">
            <button
              className="nb-row__more-btn"
              onClick={onToggleRowMenu}
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal size={13} />
            </button>
            {rowMenuOpen && (
              <div className="nb-row-menu__dropdown">
                <button
                  className="nb-row-menu__item"
                  onClick={() => { onCloseRowMenu(); onMoveToFolder(); }}
                >
                  Move to folder
                </button>
                <button
                  className="nb-row-menu__item nb-row-menu__item--danger"
                  onClick={() => { onCloseRowMenu(); onStartDelete(); }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NbTable ───────────────────────────────────────────────────────────────────

interface NbTableProps {
  list: NotebookMeta[];
  getAnnotation: (id: string) => NotebookAnnotation;
  folders: FolderType[];
  selected: Set<string>;
  onToggleSel: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
  showFolderPath: boolean;
  sourceCounts: Record<string, number>;
  fetchingSourcesId: string | null;
  exportingId: string | null;
  setExportingId: (id: string | null) => void;
  onExport: (notebookId: string, title: string, type: string) => void;
  taggingId: string | null;
  setTaggingId: (id: string | null) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  confirmingDeleteId: string | null;
  setConfirmingDeleteId: (id: string | null) => void;
  deletingId: string | null;
  onDelete: (id: string) => void;
  compact: boolean;
  rowMenuId: string | null;
  setRowMenuId: (id: string | null) => void;
  onMoveNotebookToFolder: (notebookId: string) => void;
}

function NbTable({
  list, getAnnotation, folders, selected, onToggleSel, onToggleAll, onOpenDetail,
  showFolderPath, sourceCounts, fetchingSourcesId, exportingId, setExportingId, onExport,
  taggingId, setTaggingId, onAddTag, onRemoveTag,
  confirmingDeleteId, setConfirmingDeleteId, deletingId, onDelete, compact,
  rowMenuId, setRowMenuId, onMoveNotebookToFolder,
}: NbTableProps) {
  if (list.length === 0) return null;

  const getFolderPath = (annotation: NotebookAnnotation): string | null => {
    if (!annotation.folderId) return null;
    const parts: string[] = [];
    let cur = folders.find((f) => f.id === annotation.folderId);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
    }
    return parts.join(' / ');
  };

  const allSelected = list.every((n) => selected.has(n.id));

  return (
    <div className="nb-table">
      {/* Header */}
      <div className="nb-table__head">
        <div className="nb-row__select">
          <input
            type="checkbox"
            className="notebooks-checkbox"
            checked={list.length > 0 && allSelected}
            onChange={() => onToggleAll(list.map((n) => n.id))}
            title="Select all"
          />
        </div>
        <div className="nb-table__head-title">Title</div>
        <div className="nb-table__head-tags">Tags</div>
        <div className="nb-table__head-sources">Sources</div>
        <div className="nb-table__head-synced">Last synced ↓</div>
        <div />
      </div>

      {/* Rows */}
      {list.map((nb, i) => {
        const annotation = getAnnotation(nb.id);
        return (
          <NbRow
            key={nb.id}
            notebook={nb}
            annotation={annotation}
            isLast={i === list.length - 1}
            selected={selected.has(nb.id)}
            onToggleSel={() => onToggleSel(nb.id)}
            onOpenDetail={() => onOpenDetail(nb.id)}
            showFolderPath={showFolderPath}
            folderPath={getFolderPath(annotation)}
            sourceCounts={sourceCounts}
            fetchingSourcesId={fetchingSourcesId}
            exportingId={exportingId}
            onToggleExport={() => setExportingId(exportingId === nb.id ? null : nb.id)}
            onExport={(type) => {
              setExportingId(null);
              void onExport(nb.id, nb.title, type);
            }}
            taggingId={taggingId}
            onStartTag={() => setTaggingId(nb.id)}
            onAddTag={(tag) => onAddTag(nb.id, tag)}
            onRemoveTag={(tag) => onRemoveTag(nb.id, tag)}
            onStopTag={() => setTaggingId(null)}
            confirmingDeleteId={confirmingDeleteId}
            deletingId={deletingId}
            onStartDelete={() => setConfirmingDeleteId(nb.id)}
            onConfirmDelete={() => { setConfirmingDeleteId(null); void onDelete(nb.id); }}
            onCancelDelete={() => setConfirmingDeleteId(null)}
            compact={compact}
            rowMenuOpen={rowMenuId === nb.id}
            onToggleRowMenu={() => setRowMenuId(rowMenuId === nb.id ? null : nb.id)}
            onCloseRowMenu={() => setRowMenuId(null)}
            onMoveToFolder={() => onMoveNotebookToFolder(nb.id)}
          />
        );
      })}
    </div>
  );
}

// ── SubfolderCards ────────────────────────────────────────────────────────────

interface SubfolderCardsProps {
  parentId: string;
  folders: FolderType[];
  notebookCountByFolder: Map<string, number>;
  onSelect: (id: string) => void;
}

function SubfolderCards({ parentId, folders, notebookCountByFolder, onSelect }: SubfolderCardsProps) {
  const children = folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => {
      const oa = a.sortOrder ?? Infinity;
      const ob = b.sortOrder ?? Infinity;
      return oa !== ob ? oa - ob : a.name.localeCompare(b.name);
    });

  if (children.length === 0) return null;

  return (
    <div className="nb-subfolder-cards">
      {children.map((child) => {
        const grandchildren = folders.filter((f) => f.parentId === child.id);
        const count = notebookCountByFolder.get(child.id) ?? 0;
        return (
          <button
            key={child.id}
            className="nb-subfolder-card"
            onClick={() => onSelect(child.id)}
          >
            <div className="nb-subfolder-card__top">
              <span className="nb-subfolder-card__icon">
                <Folder size={18} strokeWidth={1.5} />
              </span>
              {grandchildren.length > 0 && (
                <span className="nb-subfolder-card__sub-badge">
                  {grandchildren.length} sub
                </span>
              )}
            </div>
            <div className="nb-subfolder-card__body">
              <div className="nb-subfolder-card__name">{child.name}</div>
              <div className="nb-subfolder-card__count">
                {count} notebook{count !== 1 ? 's' : ''}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── GroupedNbList ─────────────────────────────────────────────────────────────

interface GroupedNbListProps {
  parentId: string;
  folders: FolderType[];
  notebooks: NotebookMeta[];
  search: string;
  getAnnotation: (id: string) => NotebookAnnotation;
  notebookCountByFolder: Map<string, number>;
  onSelect: (id: string) => void;
  tableProps: Omit<NbTableProps, 'list' | 'showFolderPath'>;
}

function GroupedNbList({ parentId, folders, notebooks, search, getAnnotation, onSelect, tableProps }: GroupedNbListProps) {
  const children = folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => {
      const oa = a.sortOrder ?? Infinity;
      const ob = b.sortOrder ?? Infinity;
      return oa !== ob ? oa - ob : a.name.localeCompare(b.name);
    });

  const directNbs = notebooks.filter((n) => {
    const fid = getAnnotation(n.id).folderId;
    return fid === parentId && (!search || n.title.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="nb-grouped-list">
      {directNbs.length > 0 && (
        <div className="nb-group-section">
          <div className="nb-section-label">In this folder</div>
          <NbTable {...tableProps} list={directNbs} showFolderPath={false} />
        </div>
      )}

      {children.map((child) => {
        const subtree = getFolderSubtreeIds(child.id, folders);
        const childNbs = notebooks.filter((n) => {
          const fid = getAnnotation(n.id).folderId;
          return fid !== undefined && subtree.has(fid) && (!search || n.title.toLowerCase().includes(search.toLowerCase()));
        });
        if (childNbs.length === 0) return null;
        return (
          <div key={child.id} className="nb-group-section">
            <button className="nb-group-header" onClick={() => onSelect(child.id)}>
              <span className="nb-group-header__icon">
                <Folder size={13} strokeWidth={1.6} />
              </span>
              <span className="nb-group-header__name">{child.name}</span>
              <ChevronRight size={11} strokeWidth={2} className="nb-group-header__arrow" />
              <span className="nb-group-header__count">
                {childNbs.length} notebook{childNbs.length !== 1 ? 's' : ''}
              </span>
            </button>
            <NbTable {...tableProps} list={childNbs} showFolderPath={false} />
          </div>
        );
      })}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="nb-empty-state">
      <BookOpen size={30} strokeWidth={1.2} />
      <div className="nb-empty-state__title">No notebooks here</div>
      <div className="nb-empty-state__hint">Move notebooks into this folder or sync from NotebookLM</div>
    </div>
  );
}

// ── NotebooksPage ─────────────────────────────────────────────────────────────

export default function NotebooksPage() {
  const { handleOpenNotebookDetail: onOpenNotebook } = useNavigation();

  const {
    notebooks,
    notebookCountByFolder,
    isLoading,
    isSyncing,
    lastSyncedAt,
    syncError,
    deletingId,
    deleteError,
    setDeleteError,
    sourceCounts,
    fetchingSourcesId,
    sourceExportError,
    setSourceExportError,
    handleExportSources,
    folders,
    activeFolderId,
    setActiveFolderId,
    selectedIds,
    toggleSelectNotebook,
    toggleSelectAll,
    clearSelection,
    getAnnotation,
    handleRefresh,
    handleDelete,
    handleAddTag,
    handleRemoveTag,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFolder,
    handleAssignFolder,
    handleBulkAssignFolder,
    handleCreateNotebook,
    handleMergeNotebooks,
    handleBulkDelete,
  } = useNotebooksPage();

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [taggingNotebookId, setTaggingNotebookId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [exportingNotebookId, setExportingNotebookId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningNotebookId, setAssigningNotebookId] = useState<string | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [showNewNotebookModal, setShowNewNotebookModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Sidebar folder management
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState('');
  const [creatingSubfolderParentId, setCreatingSubfolderParentId] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [subfolderError, setSubfolderError] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const unfiledCount = notebooks.filter((n) => !getAnnotation(n.id).folderId).length;

  const activeFolder = activeFolderId && activeFolderId !== UNFILED_FILTER_ID
    ? folders.find((f) => f.id === activeFolderId) ?? null
    : null;

  const hasChildren = activeFolder
    ? folders.some((f) => f.parentId === activeFolder.id)
    : false;

  const breadcrumb = useMemo(
    () => getBreadcrumb(activeFolderId, folders),
    [activeFolderId, folders],
  );

  const flatList = useMemo(() => {
    const matchSearch = (n: NotebookMeta) =>
      !search || n.title.toLowerCase().includes(search.toLowerCase());

    if (activeFolderId === null) return notebooks.filter(matchSearch);

    if (activeFolderId === UNFILED_FILTER_ID) {
      return notebooks.filter((n) => !getAnnotation(n.id).folderId && matchSearch(n));
    }

    const ids = includeSubfolders
      ? getFolderSubtreeIds(activeFolderId, folders)
      : new Set([activeFolderId]);

    return notebooks.filter((n) => {
      const fid = getAnnotation(n.id).folderId;
      return fid !== undefined && ids.has(fid) && matchSearch(n);
    });
  }, [notebooks, activeFolderId, folders, includeSubfolders, search, getAnnotation]);

  const totalInView = useMemo(() => {
    if (activeFolderId === null) return notebooks.length;
    if (activeFolderId === UNFILED_FILTER_ID) return unfiledCount;
    const subtree = getFolderSubtreeIds(activeFolderId, folders);
    return notebooks.filter((n) => {
      const fid = getAnnotation(n.id).folderId;
      return fid !== undefined && subtree.has(fid);
    }).length;
  }, [notebooks, activeFolderId, folders, unfiledCount, getAnnotation]);

  // ── Sidebar handlers ────────────────────────────────────────────────────────

  async function handleCreateRootFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const id = await handleCreateFolder(name);
      setNewFolderName('');
      setIsCreatingFolder(false);
      setNewFolderError('');
      setActiveFolderId(id);
    } catch (err) {
      setNewFolderError(err instanceof Error ? err.message : 'Failed to create folder.');
    }
  }

  async function handleCreateSubfolderConfirm() {
    if (!creatingSubfolderParentId) return;
    const name = newSubfolderName.trim();
    if (!name) return;
    try {
      await handleCreateFolder(name, creatingSubfolderParentId);
      setCreatingSubfolderParentId(null);
      setNewSubfolderName('');
      setSubfolderError('');
    } catch (err) {
      setSubfolderError(err instanceof Error ? err.message : 'Failed to create subfolder.');
    }
  }

  async function handleRenameConfirm() {
    if (!renamingFolderId) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      await handleRenameFolder(renamingFolderId, name);
      setRenamingFolderId(null);
      setRenameValue('');
      setRenameError('');
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename folder.');
    }
  }

  function startRenaming(id: string, currentName: string) {
    setRenamingFolderId(id);
    setRenameValue(currentName);
    setRenameError('');
    setCreatingSubfolderParentId(null);
  }

  function startCreatingSubfolder(parentId: string) {
    setCreatingSubfolderParentId(parentId);
    setNewSubfolderName('');
    setSubfolderError('');
    setRenamingFolderId(null);
  }

  // ── Title for breadcrumb/header ──────────────────────────────────────────────

  const pageTitle = activeFolderId === null
    ? 'All Notebooks'
    : activeFolderId === UNFILED_FILTER_ID
      ? 'Unfiled'
      : (activeFolder?.name ?? 'Notebooks');

  // ── Table shared props ───────────────────────────────────────────────────────

  const tableSharedProps = {
    getAnnotation,
    folders,
    selected: selectedIds,
    onToggleSel: toggleSelectNotebook,
    onToggleAll: toggleSelectAll,
    onOpenDetail: onOpenNotebook,
    sourceCounts,
    fetchingSourcesId,
    exportingId: exportingNotebookId,
    setExportingId: setExportingNotebookId,
    onExport: handleExportSources,
    taggingId: taggingNotebookId,
    setTaggingId: setTaggingNotebookId,
    onAddTag: handleAddTag,
    onRemoveTag: handleRemoveTag,
    confirmingDeleteId,
    setConfirmingDeleteId,
    deletingId,
    onDelete: handleDelete,
    compact: false,
    rowMenuId,
    setRowMenuId,
    onMoveNotebookToFolder: (notebookId: string) => {
      setAssigningNotebookId(notebookId);
      setShowAssignModal(true);
    },
  } as const;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="notebooks-page">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="notebooks-page__sidebar">

        {/* Panel header */}
        <div className="notebooks-sidebar__panel-header">
          <span className="notebooks-sidebar__panel-label">Folders</span>
          <button
            className="notebooks-sidebar__add-btn"
            onClick={() => setIsCreatingFolder(true)}
            title="New folder"
          >
            +
          </button>
        </div>

        {/* Tree scroll area */}
        <div className="notebooks-sidebar__tree-scroll">

          {/* Virtual "All Notebooks" root */}
          <button
            className={`notebooks-sidebar__virtual-row${activeFolderId === null ? ' notebooks-sidebar__virtual-row--active' : ''}`}
            onClick={() => setActiveFolderId(null)}
          >
            <span className="notebooks-sidebar__virtual-icon">
              {activeFolderId === null
                ? <FolderOpen size={13} strokeWidth={1.6} />
                : <Folder size={13} strokeWidth={1.6} />}
            </span>
            <span className="notebooks-sidebar__virtual-label">All Notebooks</span>
            <span className="notebooks-sidebar__virtual-count">{notebooks.length}</span>
          </button>

          {/* Folder tree */}
          {folders.length > 0 && (
            <div className="notebooks-sidebar__tree-wrap">
              <FolderTree
                folders={folders}
                selectedId={activeFolderId ?? undefined}
                onSelect={setActiveFolderId}
                snippetCountByFolder={notebookCountByFolder}
                onCreateSubfolder={startCreatingSubfolder}
                onRename={startRenaming}
                onDelete={handleDeleteFolder}
                onMove={(id) => setMovingFolderId(id)}
              />
            </div>
          )}

          {/* Inline subfolder creation form */}
          {creatingSubfolderParentId && (
            <div className="notebooks-sidebar__inline-form">
              <span className="notebooks-sidebar__inline-label">
                Inside "{folders.find((f) => f.id === creatingSubfolderParentId)?.name}":
              </span>
              <input
                className="notebooks-sidebar__inline-input"
                autoFocus
                placeholder="Subfolder name…"
                value={newSubfolderName}
                onChange={(e) => { setNewSubfolderName(e.target.value); setSubfolderError(''); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateSubfolderConfirm();
                  if (e.key === 'Escape') { setCreatingSubfolderParentId(null); setNewSubfolderName(''); }
                }}
              />
              <div className="notebooks-sidebar__inline-actions">
                <button className="notebooks-sidebar__inline-confirm" onClick={() => void handleCreateSubfolderConfirm()}>Create</button>
                <button className="notebooks-sidebar__inline-cancel" onClick={() => { setCreatingSubfolderParentId(null); setNewSubfolderName(''); }}>Cancel</button>
              </div>
              {subfolderError && <p className="notebooks-sidebar__inline-error">{subfolderError}</p>}
            </div>
          )}

          {/* Inline rename form */}
          {renamingFolderId && (
            <div className="notebooks-sidebar__inline-form">
              <span className="notebooks-sidebar__inline-label">Rename folder:</span>
              <input
                className="notebooks-sidebar__inline-input"
                autoFocus
                value={renameValue}
                onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRenameConfirm();
                  if (e.key === 'Escape') { setRenamingFolderId(null); setRenameValue(''); }
                }}
              />
              <div className="notebooks-sidebar__inline-actions">
                <button className="notebooks-sidebar__inline-confirm" onClick={() => void handleRenameConfirm()}>Rename</button>
                <button className="notebooks-sidebar__inline-cancel" onClick={() => { setRenamingFolderId(null); setRenameValue(''); }}>Cancel</button>
              </div>
              {renameError && <p className="notebooks-sidebar__inline-error">{renameError}</p>}
            </div>
          )}

          {/* New root folder form */}
          {isCreatingFolder && (
            <div className="notebooks-sidebar__inline-form">
              <input
                ref={newFolderInputRef}
                className="notebooks-sidebar__inline-input"
                autoFocus
                placeholder="Folder name…"
                value={newFolderName}
                onChange={(e) => { setNewFolderName(e.target.value); setNewFolderError(''); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateRootFolder();
                  if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
                }}
              />
              <div className="notebooks-sidebar__inline-actions">
                <button className="notebooks-sidebar__inline-confirm" onClick={() => void handleCreateRootFolder()}>Create</button>
                <button className="notebooks-sidebar__inline-cancel" onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}>Cancel</button>
              </div>
              {newFolderError && <p className="notebooks-sidebar__inline-error">{newFolderError}</p>}
            </div>
          )}
        </div>

        {/* Sync footer */}
        <div className="notebooks-sidebar__sync-footer">
          <RefreshCw size={10} strokeWidth={2} className={isSyncing ? 'notebooks-sidebar__sync-icon--spinning' : ''} />
          <span className="notebooks-sidebar__sync-time">
            {lastSyncedAt ? `Synced ${formatRelativeTime(lastSyncedAt)}` : 'Not yet synced'}
          </span>
          <button
            className="notebooks-sidebar__sync-now"
            onClick={handleRefresh}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="notebooks-page__content">

        {/* Error banners */}
        {syncError && (
          <div className="notebooks-page__error">
            Could not reach NotebookLM. Make sure you are signed into Google in this browser.
          </div>
        )}
        {deleteError && (
          <div className="notebooks-page__error">
            {deleteError}
            <button className="notebooks-page__error-dismiss" onClick={() => setDeleteError(null)}>&#x2715;</button>
          </div>
        )}
        {sourceExportError && (
          <div className="notebooks-page__error">
            {sourceExportError}
            <button className="notebooks-page__error-dismiss" onClick={() => setSourceExportError(null)}>&#x2715;</button>
          </div>
        )}

        {isLoading ? (
          <div className="notebooks-page__loading">Loading…</div>
        ) : notebooks.length === 0 ? (
          <div className="notebooks-page__empty">
            <span className="notebooks-page__empty-icon"><BookOpen size={48} strokeWidth={1.5} /></span>
            <p className="notebooks-page__empty-text">No notebooks found</p>
            <p className="notebooks-page__empty-hint">
              Sign into Google and your NotebookLM notebooks will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Page header */}
            <div className="notebooks-content__page-header">
              {/* Breadcrumb */}
              {(breadcrumb.length > 0 || activeFolderId === UNFILED_FILTER_ID) && (
                <div className="notebooks-content__breadcrumb">
                  <button
                    className="notebooks-breadcrumb__item notebooks-breadcrumb__item--link"
                    onClick={() => setActiveFolderId(null)}
                  >
                    All Notebooks
                  </button>
                  {breadcrumb.map((f, i) => (
                    <React.Fragment key={f.id}>
                      <ChevronRight size={10} strokeWidth={2} className="notebooks-breadcrumb__sep" />
                      {i < breadcrumb.length - 1 ? (
                        <button
                          className="notebooks-breadcrumb__item notebooks-breadcrumb__item--link"
                          onClick={() => setActiveFolderId(f.id)}
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span className="notebooks-breadcrumb__item notebooks-breadcrumb__item--current">
                          {f.name}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                  {activeFolderId === UNFILED_FILTER_ID && (
                    <>
                      <ChevronRight size={10} strokeWidth={2} className="notebooks-breadcrumb__sep" />
                      <span className="notebooks-breadcrumb__item notebooks-breadcrumb__item--current">Unfiled</span>
                    </>
                  )}
                </div>
              )}

              {/* Title row */}
              <div className="notebooks-content__title-row">
                <span className="notebooks-content__folder-icon">
                  {activeFolderId === null || activeFolderId === UNFILED_FILTER_ID
                    ? <Folder size={20} strokeWidth={1.5} />
                    : hasChildren
                      ? <FolderOpen size={20} strokeWidth={1.5} />
                      : <Folder size={20} strokeWidth={1.5} />}
                </span>
                <h1 className="notebooks-content__title">{pageTitle}</h1>
                <span className="notebooks-content__total">{totalInView} total</span>
                <div className="notebooks-content__title-actions">
                  <button
                    className="notebooks-content__action-btn notebooks-content__action-btn--primary"
                    onClick={() => setShowNewNotebookModal(true)}
                    title="Create a new notebook"
                  >
                    <Plus size={12} strokeWidth={2} />
                    New notebook
                  </button>
                  <button
                    className="notebooks-content__action-btn"
                    onClick={() => setShowMergeModal(true)}
                    disabled={selectedIds.size < 2}
                    title={selectedIds.size < 2 ? 'Select 2 or more notebooks to merge' : 'Merge selected notebooks'}
                  >
                    <GitMerge size={12} strokeWidth={2} />
                    Merge selected
                  </button>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="notebooks-content__toolbar">
              <div className="notebooks-content__search">
                <Search size={12} strokeWidth={2} className="notebooks-content__search-icon" />
                <input
                  className="notebooks-content__search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notebooks…"
                />
                {search && (
                  <button className="notebooks-content__search-clear" onClick={() => setSearch('')}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {hasChildren && (
                <button
                  className={`notebooks-include-toggle${includeSubfolders ? ' notebooks-include-toggle--active' : ''}`}
                  onClick={() => setIncludeSubfolders((v) => !v)}
                >
                  <Layers size={12} />
                  Include subfolders
                </button>
              )}

              <span className="notebooks-content__count">
                {flatList.length} notebook{flatList.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="notebooks-bulk-bar">
                <span className="notebooks-bulk-bar__count">
                  {selectedIds.size} selected
                </span>
                <button
                  className="notebooks-bulk-bar__btn"
                  onClick={() => setShowAssignModal(true)}
                >
                  Move to folder
                </button>
                <button
                  className="notebooks-bulk-bar__btn"
                  onClick={() => {
                    const id = [...selectedIds][0];
                    setTaggingNotebookId(id);
                  }}
                >
                  Tag
                </button>
                <button
                  className="notebooks-bulk-bar__btn notebooks-bulk-bar__btn--danger"
                  onClick={() => void handleBulkDelete([...selectedIds])}
                >
                  Delete
                </button>
                <button className="notebooks-bulk-bar__clear" onClick={clearSelection}>
                  Clear
                </button>
              </div>
            )}

            {/* Content area — overlay to close export/row menus */}
            {(exportingNotebookId || rowMenuId) && (
              <div className="notebooks-overlay" onClick={() => { setExportingNotebookId(null); setRowMenuId(null); }} />
            )}

            <div className="notebooks-content__scroll">

              {/* CASE A: parent folder + subfolders NOT included */}
              {activeFolder && hasChildren && !includeSubfolders ? (
                <div>
                  <div className="nb-section-label">
                    Subfolders · {folders.filter((f) => f.parentId === activeFolder.id).length}
                  </div>
                  <SubfolderCards
                    parentId={activeFolder.id}
                    folders={folders}
                    notebookCountByFolder={notebookCountByFolder}
                    onSelect={setActiveFolderId}
                  />
                  {flatList.length > 0 && (
                    <>
                      <div className="nb-section-label" style={{ marginTop: 20 }}>
                        In this folder · {flatList.length}
                      </div>
                      <div className="nb-table-card">
                        <NbTable {...tableSharedProps} list={flatList} showFolderPath={false} />
                      </div>
                    </>
                  )}
                  {flatList.length === 0 && <EmptyState />}
                </div>

              /* CASE B: parent folder + subfolders included */
              ) : activeFolder && hasChildren && includeSubfolders ? (
                flatList.length > 0 ? (
                  <GroupedNbList
                    parentId={activeFolder.id}
                    folders={folders}
                    notebooks={notebooks}
                    search={search}
                    getAnnotation={getAnnotation}
                    notebookCountByFolder={notebookCountByFolder}
                    onSelect={setActiveFolderId}
                    tableProps={tableSharedProps}
                  />
                ) : <EmptyState />

              /* CASE C: leaf folder, unfiled, or all-notebooks */
              ) : (
                flatList.length > 0 ? (
                  <div className="nb-table-card">
                    <NbTable
                      {...tableSharedProps}
                      list={flatList}
                      showFolderPath={activeFolderId === null}
                    />
                  </div>
                ) : <EmptyState />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Move folder dialog ─────────────────────────────────────────────── */}
      {movingFolderId && (
        <MoveFolderDialog
          folderId={movingFolderId}
          folders={folders}
          onMove={(newParentId) => handleMoveFolder(movingFolderId, newParentId)}
          onClose={() => setMovingFolderId(null)}
        />
      )}

      {/* ── New notebook modal ─────────────────────────────────────────────── */}
      {showNewNotebookModal && (
        <NewNotebookModal
          onCreate={handleCreateNotebook}
          onClose={() => setShowNewNotebookModal(false)}
        />
      )}

      {/* ── Merge notebooks modal ──────────────────────────────────────────── */}
      {showMergeModal && (
        <MergeNotebookModal
          selectedNotebooks={notebooks.filter((n) => selectedIds.has(n.id))}
          onMerge={handleMergeNotebooks}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {/* ── Assign folder modal ────────────────────────────────────────────── */}
      {showAssignModal && (
        <NotebookFolderModal
          folders={folders}
          currentFolderId={
            assigningNotebookId
              ? getAnnotation(assigningNotebookId).folderId
              : selectedIds.size === 1
                ? getAnnotation([...selectedIds][0]).folderId
                : undefined
          }
          subjectLabel={
            assigningNotebookId
              ? (notebooks.find((n) => n.id === assigningNotebookId)?.title ?? '1 notebook')
              : selectedIds.size === 1
                ? (notebooks.find((n) => n.id === [...selectedIds][0])?.title ?? '1 notebook')
                : `${selectedIds.size} notebooks`
          }
          onConfirm={(folderId) => {
            if (assigningNotebookId) {
              void handleAssignFolder(assigningNotebookId, folderId);
            } else {
              void handleBulkAssignFolder([...selectedIds], folderId);
            }
          }}
          onCreateFolder={handleCreateFolder}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningNotebookId(null);
          }}
        />
      )}
    </div>
  );
}
