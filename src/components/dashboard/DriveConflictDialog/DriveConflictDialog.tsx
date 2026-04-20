import React from 'react';
import type { ConflictSummary } from '@/services/drive/drive-init-service';
import './DriveConflictDialog.css';

interface DriveConflictDialogProps {
  summary: ConflictSummary;
  onMerge: () => void;
  onOverwrite: () => void;
}

export default function DriveConflictDialog({ summary, onMerge, onOverwrite }: DriveConflictDialogProps) {
  const driveDate = summary.driveLastSync > 0
    ? new Date(summary.driveLastSync).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : 'unknown';

  return (
    <div className="drive-conflict-dialog__overlay">
      <div className="drive-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="drive-conflict-title">
        <div className="drive-conflict-dialog__header">
          <h2 className="drive-conflict-dialog__title" id="drive-conflict-title">Data sync conflict</h2>
        </div>

        <p className="drive-conflict-dialog__desc">
          This device has data that hasn't been synced to Drive, and Drive has data from another session.
          Choose how to resolve the conflict.
        </p>

        <div className="drive-conflict-dialog__comparison">
          <div className="drive-conflict-dialog__column">
            <div className="drive-conflict-dialog__column-label">On this device</div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.localSnippetCount}</span>
              <span className="drive-conflict-dialog__stat-label">snippets</span>
            </div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.localFolderCount}</span>
              <span className="drive-conflict-dialog__stat-label">folders</span>
            </div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.localTagCount}</span>
              <span className="drive-conflict-dialog__stat-label">tags</span>
            </div>
          </div>

          <div className="drive-conflict-dialog__divider" aria-hidden="true">vs</div>

          <div className="drive-conflict-dialog__column">
            <div className="drive-conflict-dialog__column-label">In your Drive</div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.driveSnippetCount}</span>
              <span className="drive-conflict-dialog__stat-label">snippets</span>
            </div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.driveFolderCount}</span>
              <span className="drive-conflict-dialog__stat-label">folders</span>
            </div>
            <div className="drive-conflict-dialog__stat">
              <span className="drive-conflict-dialog__stat-value">{summary.driveTagCount}</span>
              <span className="drive-conflict-dialog__stat-label">tags</span>
            </div>
            <div className="drive-conflict-dialog__last-sync">Last synced {driveDate}</div>
          </div>
        </div>

        <div className="drive-conflict-dialog__footer">
          <button
            className="drive-conflict-dialog__btn drive-conflict-dialog__btn--secondary"
            onClick={onOverwrite}
            type="button"
          >
            Use Drive data
          </button>
          <button
            className="drive-conflict-dialog__btn drive-conflict-dialog__btn--primary"
            onClick={onMerge}
            type="button"
          >
            Merge my data
          </button>
        </div>
      </div>
    </div>
  );
}
