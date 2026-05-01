/**
 * @module usePromptsTable
 * @description React hook that encapsulates all state and derived data for the PromptsTable, including search filtering, multi-column sorting, folder and tag filter sets, pagination, row selection, and keyboard row navigation. Delegates filtering to filterSnippets and folder path resolution to folder-utils.
 * @dependencies @/types, @/types/dashboard, @/utils/filter-snippets, @/utils/folder-utils
 * @public usePromptsTable
 */
import { useCallback, useMemo, useState } from 'react';
import type { Folder, Snippet } from '@/types';
import type { SortColumn, SortDirection } from '@/types/dashboard';
import { filterSnippets } from '@/utils/filter-snippets';
import { getFolderPath } from '@/utils/folder-utils';

const DEFAULT_SORT_COLUMN: SortColumn = 'savedAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';
const DEFAULT_ROWS_PER_PAGE = 25;

export function usePromptsTable(snippets: Snippet[], folders: Folder[] = []) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [snippets]);

  const filtered = useMemo(
    () => filterSnippets(snippets, searchQuery, selectedFolderIds, selectedTags, folders),
    [snippets, searchQuery, selectedFolderIds, selectedTags, folders],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'text':
          return dir * a.text.localeCompare(b.text);
        case 'source':
          return dir * a.source.localeCompare(b.source);
        case 'folder':
          return dir * getFolderPath(a.folderId ?? '', folders).localeCompare(
            getFolderPath(b.folderId ?? '', folders),
          );
        case 'tags':
          return dir * (a.tags?.join(',') ?? '').localeCompare(b.tags?.join(',') ?? '');
        case 'savedAt':
          return dir * (a.savedAt - b.savedAt);
        default:
          return 0;
      }
    });

    return copy;
  }, [filtered, sortColumn, sortDirection]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, currentPage, rowsPerPage]);

  const isAllPageSelected = useMemo(
    () => paginated.length > 0 && paginated.every((s) => selectedIds.has(s.id)),
    [paginated, selectedIds],
  );

  const handleSortChange = (col: SortColumn) => {
    if (col === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    setFocusedRowIndex(-1);
  };

  const handleRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setCurrentPage(1);
    setFocusedRowIndex(-1);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (paginated.every((s) => prev.has(s.id))) {
        const next = new Set(prev);
        paginated.forEach((s) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      paginated.forEach((s) => next.add(s.id));
      return next;
    });
  }, [paginated]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Keyboard row navigation ──────────────────────────────────────────────

  const moveFocusDown = useCallback(() => {
    setFocusedRowIndex((prev) =>
      prev === -1 ? 0 : Math.min(prev + 1, paginated.length - 1),
    );
  }, [paginated.length]);

  const moveFocusUp = useCallback(() => {
    setFocusedRowIndex((prev) => (prev <= 0 ? 0 : prev - 1));
  }, []);

  const toggleFocusedSelect = useCallback(() => {
    setFocusedRowIndex((prev) => {
      if (prev >= 0 && prev < paginated.length) {
        toggleSelect(paginated[prev].id);
      }
      return prev;
    });
  }, [paginated, toggleSelect]);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
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
    filteredCount: filtered.length,
    totalCount: snippets.length,
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
  };
}
