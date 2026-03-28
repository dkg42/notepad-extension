import React from 'react';
import { Clock } from 'lucide-react';
import { useExportHistoryPage } from './useExportHistoryPage';
import './ExportHistoryPage.css';

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export default function ExportHistoryPage() {
  const { history, isLoading, handleClear } = useExportHistoryPage();

  return (
    <div className="export-history-page">
      <div className="export-history-page__header">
        <div>
          <h1 className="export-history-page__heading">Export History</h1>
          <p className="export-history-page__subheading">
            A log of all chat and prompt exports from this extension.
          </p>
        </div>
        {history.length > 0 && (
          <button className="export-history-page__clear-btn" onClick={handleClear}>
            Clear history
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="export-history-page__loading">Loading…</div>
      ) : history.length === 0 ? (
        <div className="export-history-page__empty">
          <span className="export-history-page__empty-icon">
            <Clock size={36} strokeWidth={1.5} />
          </span>
          <p>No exports recorded yet.</p>
        </div>
      ) : (
        <div className="export-history-page__table-wrap">
          <table className="export-history-table">
            <thead>
              <tr>
                <th className="export-history-table__th">Date</th>
                <th className="export-history-table__th">Format</th>
                <th className="export-history-table__th">Items</th>
                <th className="export-history-table__th">Source</th>
                <th className="export-history-table__th">File</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="export-history-table__row">
                  <td className="export-history-table__td">
                    {formatDate(record.exportedAt)}
                  </td>
                  <td className="export-history-table__td">
                    <span className="export-history-table__badge">{record.format}</span>
                  </td>
                  <td className="export-history-table__td">{record.itemCount}</td>
                  <td className="export-history-table__td export-history-table__td--source">
                    {record.source}
                  </td>
                  <td className="export-history-table__td">
                    {record.filename ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
