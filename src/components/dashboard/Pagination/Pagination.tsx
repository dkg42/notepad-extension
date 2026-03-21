import React from 'react';
import { usePagination } from './usePagination';
import './Pagination.css';

const ROWS_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: PaginationProps) {
  const { totalPages, showingFrom, showingTo, canGoPrev, canGoNext, displayPage } =
    usePagination({ currentPage, totalItems, rowsPerPage });

  return (
    <div className="pagination">
      <span className="pagination__info">
        {totalItems === 0
          ? 'No results'
          : `Showing ${showingFrom}–${showingTo} of ${totalItems}`}
      </span>

      <div className="pagination__controls">
        <button
          className="pagination__btn"
          onClick={() => onPageChange(displayPage - 1)}
          disabled={!canGoPrev}
        >
          ← Prev
        </button>
        <span className="pagination__page">
          Page {displayPage} of {totalPages}
        </span>
        <button
          className="pagination__btn"
          onClick={() => onPageChange(displayPage + 1)}
          disabled={!canGoNext}
        >
          Next →
        </button>
      </div>

      <div className="pagination__right">
        <span className="pagination__rows-label">Rows per page:</span>
        <select
          className="pagination__rows-select"
          value={rowsPerPage}
          onChange={(e) => {
            onRowsPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
        >
          {ROWS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
