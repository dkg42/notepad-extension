/**
 * @module usePagination
 * @description Pure computation hook that derives pagination display values (totalPages, startIndex, endIndex, canGoPrev, canGoNext, showingFrom, showingTo) from current page, total item count, and rows-per-page. Contains no side effects or internal state.
 * @dependencies (none)
 * @public usePagination, PaginationState
 */
export interface PaginationState {
  currentPage: number;
  totalItems: number;
  rowsPerPage: number;
}

export function usePagination({ currentPage, totalItems, rowsPerPage }: PaginationState) {
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);

  const canGoPrev = safeCurrentPage > 1;
  const canGoNext = safeCurrentPage < totalPages;

  return {
    totalPages,
    startIndex,
    endIndex,
    canGoPrev,
    canGoNext,
    displayPage: safeCurrentPage,
    showingFrom: totalItems === 0 ? 0 : startIndex + 1,
    showingTo: endIndex,
  };
}
