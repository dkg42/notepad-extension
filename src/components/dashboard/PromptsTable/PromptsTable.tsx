import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Columns3, Check, FileText } from 'lucide-react';
import type { Folder, Snippet } from '@/types';
import type { SortColumn } from '@/types/dashboard';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import Pagination from '@/components/dashboard/Pagination/Pagination';
import PromptsTableRow from '@/components/dashboard/PromptsTableRow/PromptsTableRow';
import BulkActionsBar from '@/components/dashboard/BulkActionsBar/BulkActionsBar';
import { usePromptsTable } from './usePromptsTable';
import { useColumnResize } from '@/hooks/useColumnResize';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import './PromptsTable.css';

interface Column {
  key: SortColumn;
  label: string;
  sortable: boolean;
  defaultWidth: number;
}

const COLUMNS: Column[] = [
  { key: 'text',    label: 'Prompt', sortable: true,  defaultWidth: 300 },
  { key: 'source',  label: 'Source', sortable: true,  defaultWidth: 150 },
  { key: 'folder',  label: 'Folder', sortable: true,  defaultWidth: 130 },
  { key: 'tags',    label: 'Tags',   sortable: false, defaultWidth: 190 },
  { key: 'savedAt', label: 'Saved',  sortable: true,  defaultWidth: 110 },
];

const RESIZE_STORAGE_KEY = 'prompts-table-col-widths';

interface PromptsTableProps {
  snippets: Snippet[];
  folders: Folder[];
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onToggleFavorite: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkMoveToFolder: (ids: string[], folderId: string | undefined) => Promise<void>;
  onBulkAddTags: (ids: string[], tags: string[]) => Promise<void>;
  /** Hide the search/filter toolbar — used when parent controls filtering (e.g. accordion view) */
  hideToolbar?: boolean;
  /** Extra class applied to the outermost wrapper div */
  className?: string;
  /** Columns hidden on initial render (keys from SortColumn) */
  initialHiddenColumns?: SortColumn[];
}

export default function PromptsTable({
  snippets,
  folders,
  onDelete,
  onToggleFavorite,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkAddTags,
  hideToolbar = false,
  className = '',
  initialHiddenColumns = [],
}: PromptsTableProps) {
  const {
    searchQuery,
    setSearchQuery,
    selectedFolderIds,
    setSelectedFolderIds,
    selectedTags,
    setSelectedTags,
    allTags,
    sortColumn,
    sortDirection,
    handleSortChange,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    handleRowsPerPageChange,
    filteredCount,
    totalCount,
    paginated,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllPageSelected,
    focusedRowIndex,
    moveFocusDown,
    moveFocusUp,
    toggleFocusedSelect,
  } = usePromptsTable(snippets);

  const { startResize, getWidth } = useColumnResize(RESIZE_STORAGE_KEY);

  // ── Column visibility ───────────────────────────────────────────────────────
  const [hiddenColumns, setHiddenColumns] = useState<Set<SortColumn>>(new Set(initialHiddenColumns));
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [columnsMenuOpen]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((col) => !hiddenColumns.has(col.key)),
    [hiddenColumns],
  );

  const toggleColumn = (key: SortColumn) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Sort icons ──────────────────────────────────────────────────────────────
  const getSortIcon = (col: Column) => {
    if (!col.sortable) return null;
    if (col.key !== sortColumn) {
      return <ChevronUp size={11} className="prompts-table__sort-icon prompts-table__sort-icon--inactive" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp size={11} className="prompts-table__sort-icon prompts-table__sort-icon--active" />
      : <ChevronDown size={11} className="prompts-table__sort-icon prompts-table__sort-icon--active" />;
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  // ── Bulk handlers ───────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    await onBulkDelete(Array.from(selectedIds));
    clearSelection();
  }, [onBulkDelete, selectedIds, clearSelection]);

  const handleBulkMoveToFolder = async (folderId: string | undefined) => {
    await onBulkMoveToFolder(Array.from(selectedIds), folderId);
    clearSelection();
  };

  const handleBulkAddTags = async (tags: string[]) => {
    await onBulkAddTags(Array.from(selectedIds), tags);
    clearSelection();
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const shortcuts = useMemo(
    () => [
      { key: 'j', description: 'Next row',            handler: moveFocusDown },
      { key: 'k', description: 'Previous row',         handler: moveFocusUp },
      { key: 'x', description: 'Toggle row selection', handler: toggleFocusedSelect },
      {
        key: 'Delete',
        description: 'Delete selected rows',
        handler: () => {
          if (selectedIds.size > 0) void handleBulkDelete();
        },
      },
      { key: 'Escape', description: 'Clear selection', handler: clearSelection },
    ],
    [moveFocusDown, moveFocusUp, toggleFocusedSelect, selectedIds, handleBulkDelete, clearSelection],
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className={`prompts-table-wrapper${className ? ` ${className}` : ''}`}>
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          folders={folders}
          onDelete={handleBulkDelete}
          onMoveToFolder={handleBulkMoveToFolder}
          onAddTags={handleBulkAddTags}
          onClearSelection={clearSelection}
        />
      )}

      {/* ── Toolbar ── */}
      {!hideToolbar && <div className="prompts-table__toolbar">
        <div className="prompts-table__toolbar-search">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search prompts…"
          />
        </div>

        {folders.length > 0 && (
          <select
            className="prompts-table__filter-select"
            value={selectedFolderIds.size === 1 ? [...selectedFolderIds][0] : ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFolderIds(val ? new Set([val]) : new Set());
            }}
          >
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        {allTags.length > 0 && (
          <select
            className="prompts-table__filter-select"
            value={selectedTags.size === 1 ? [...selectedTags][0] : ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedTags(val ? new Set([val]) : new Set());
            }}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <span className="prompts-table__count">
          {filteredCount !== totalCount
            ? `${filteredCount} of ${totalCount} prompts`
            : `${totalCount} prompt${totalCount !== 1 ? 's' : ''}`}
        </span>

        {/* Columns visibility toggle */}
        <div className="prompts-table__col-toggle" ref={columnsMenuRef}>
          <button
            className={`prompts-table__col-btn${columnsMenuOpen ? ' prompts-table__col-btn--open' : ''}`}
            onClick={() => setColumnsMenuOpen((v) => !v)}
            title="Toggle columns"
          >
            <Columns3 size={13} strokeWidth={1.75} />
            Columns
          </button>

          <AnimatePresence>
            {columnsMenuOpen && (
              <motion.div
                className="prompts-table__col-menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {COLUMNS.map((col) => {
                  const isVisible = !hiddenColumns.has(col.key);
                  return (
                    <button
                      key={col.key}
                      className="prompts-table__col-item"
                      onClick={() => toggleColumn(col.key)}
                    >
                      <span className={`prompts-table__col-check${isVisible ? ' prompts-table__col-check--on' : ''}`}>
                        {isVisible && <Check size={11} strokeWidth={2.5} />}
                      </span>
                      {col.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>}

      {/* ── Table ── */}
      <div className="prompts-table__scroll">
        <table className="prompts-table">
          <colgroup>
            <col style={{ width: 40 }} />
            {visibleColumns.map((col) => (
              <col key={col.key} style={{ width: getWidth(col.key, col.defaultWidth) }} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>

          <thead className="prompts-table__head">
            <tr>
              <th className="prompts-table__th prompts-table__th--checkbox">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={toggleSelectAll}
                  title="Select all on this page"
                />
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'prompts-table__th',
                    col.sortable ? 'prompts-table__th--sortable' : '',
                    col.sortable && col.key === sortColumn ? 'prompts-table__th--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ position: 'relative' }}
                  onClick={col.sortable ? () => handleSortChange(col.key) : undefined}
                >
                  <span className="prompts-table__th-content">
                    {col.label}
                    {getSortIcon(col)}
                  </span>
                  <div
                    className="prompts-table__resize-handle"
                    onMouseDown={startResize(col.key, getWidth(col.key, col.defaultWidth))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
              <th className="prompts-table__th">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td className="prompts-table__empty" colSpan={visibleColumns.length + 2}>
                  <span className="prompts-table__empty-icon">
                    <FileText size={32} strokeWidth={1.5} />
                  </span>
                  {snippets.length === 0
                    ? 'No prompts saved yet. Use the extension on any LLM site to save prompts.'
                    : 'No prompts match your search or filters.'}
                </td>
              </tr>
            ) : (
              paginated.map((snippet, index) => (
                <PromptsTableRow
                  key={snippet.id}
                  snippet={snippet}
                  folderName={snippet.folderId ? folderMap.get(snippet.folderId) : undefined}
                  isSelected={selectedIds.has(snippet.id)}
                  isFocused={index === focusedRowIndex}
                  hiddenColumns={hiddenColumns}
                  onToggleSelect={toggleSelect}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredCount}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  );
}
