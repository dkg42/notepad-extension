import React from 'react';
import type { BulkImportProgress as BulkImportProgressData } from '@/types';
import './BulkImportProgress.css';

interface BulkImportProgressProps {
  progress: BulkImportProgressData;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  onCancel?: () => void;
  onDone?: () => void;
}

export default function BulkImportProgress({
  progress,
  status,
  onCancel,
  onDone,
}: BulkImportProgressProps) {
  const { total, completed, failed, errors, currentUrl } = progress;
  const processed = completed + failed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isRunning = status === 'running' || status === 'pending';
  const isDone = status === 'completed' || status === 'cancelled';

  return (
    <div className="bulk-progress">
      <div className="bulk-progress__bar-track">
        <div
          className={`bulk-progress__bar-fill${isDone && failed === 0 ? ' bulk-progress__bar-fill--success' : ''}${isDone && failed > 0 ? ' bulk-progress__bar-fill--warning' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="bulk-progress__stats">
        <span className="bulk-progress__count">
          {processed} / {total} URLs processed
          {failed > 0 && <span className="bulk-progress__failed"> ({failed} failed)</span>}
        </span>
        <span className="bulk-progress__pct">{pct}%</span>
      </div>
      {isRunning && currentUrl && (
        <div className="bulk-progress__current">
          Adding: <span className="bulk-progress__current-url">{currentUrl}</span>
        </div>
      )}
      {isDone && (
        <div className="bulk-progress__summary">
          {status === 'cancelled'
            ? `Import cancelled. ${completed} added, ${failed} failed.`
            : failed === 0
              ? `All ${completed} sources added successfully.`
              : `Import complete. ${completed} added, ${failed} failed.`}
        </div>
      )}
      {errors.length > 0 && (
        <details className="bulk-progress__errors">
          <summary className="bulk-progress__errors-toggle">
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </summary>
          <ul className="bulk-progress__errors-list">
            {errors.map((e, i) => (
              <li key={i} className="bulk-progress__error-item">
                <span className="bulk-progress__error-url">{e.url}</span>
                <span className="bulk-progress__error-msg">{e.error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="bulk-progress__actions">
        {isRunning && onCancel && (
          <button className="bulk-progress__cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        {isDone && onDone && (
          <button className="bulk-progress__done-btn" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
