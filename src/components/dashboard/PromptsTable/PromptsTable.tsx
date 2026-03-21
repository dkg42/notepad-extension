import React, { useCallback, useMemo } from 'react';
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
}

export default function PromptsTable({
  snippets,
  folders,
  onDelete,
  onToggleFavorite,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkAddTags,
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

  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const getSortIcon = (col: SortColumn) => {
    if (col !== sortColumn) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const shortcuts = useMemo(
    () => [
      { key: 'j', description: 'Next row',              handler: moveFocusDown },
      { key: 'k', description: 'Previous row',           handler: moveFocusUp },
      { key: 'x', description: 'Toggle row selection',   handler: toggleFocusedSelect },
      {
        key: 'Delete',
        description: 'Delete selected rows',
        handler: () => {
          if (selectedIds.size > 0) void handleBulkDelete();
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection',
        handler: clearSelection,
      },
    ],
    [moveFocusDown, moveFocusUp, toggleFocusedSelect, selectedIds, handleBulkDelete, clearSelection],
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="prompts-table-wrapper">
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

      <div className="prompts-table__toolbar">
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
      </div>

      <div className="prompts-table__scroll">
        <table className="prompts-table">
          <colgroup>
            <col style={{ width: 40 }} />
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: getWidth(col.key, col.defaultWidth) }} />
            ))}
            <col style={{ width: 120 }} />
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
              {COLUMNS.map((col) => (
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
                  {col.label}
                  {col.sortable && (
                    <span className="prompts-table__sort-icon">{getSortIcon(col.key)}</span>
                  )}
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
                <td className="prompts-table__empty" colSpan={COLUMNS.length + 2}>
                  <span className="prompts-table__empty-icon">≡</span>
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
