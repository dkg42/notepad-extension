import React from 'react';
import { Camera, Pencil, Trash2 } from 'lucide-react';
import type { CaptureRecord } from '@/types/screenshot';
import { useScreenshotsPage } from './useScreenshotsPage';
import './ScreenshotsPage.css';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function modeLabel(mode: CaptureRecord['mode']): string {
  switch (mode) {
    case 'visible': return 'Viewport';
    case 'scrollable': return 'Full page';
    case 'selection': return 'Selection';
    case 'element': return 'Element';
  }
}

interface ThumbnailCardProps {
  capture: CaptureRecord;
  isDeleting: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ThumbnailCard({ capture, isDeleting, onEdit, onDelete }: ThumbnailCardProps) {
  return (
    <div className="screenshots-page__card">
      <div className="screenshots-page__thumb-wrap">
        <img
          className="screenshots-page__thumb"
          src={capture.dataUrl}
          alt={capture.tabTitle}
          loading="lazy"
        />
        <div className="screenshots-page__overlay">
          <button
            className="screenshots-page__overlay-btn screenshots-page__overlay-btn--edit"
            onClick={() => onEdit(capture.id)}
            title="Edit"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            className="screenshots-page__overlay-btn screenshots-page__overlay-btn--delete"
            onClick={() => onDelete(capture.id)}
            disabled={isDeleting}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="screenshots-page__card-meta">
        <span className="screenshots-page__card-title" title={capture.tabTitle}>
          {capture.tabTitle}
        </span>
        <span className="screenshots-page__card-info">
          {modeLabel(capture.mode)} · {timeAgo(capture.capturedAt)}
        </span>
      </div>
    </div>
  );
}

export default function ScreenshotsPage() {
  const { captures, isLoading, deletingId, handleDelete, handleEdit } = useScreenshotsPage();

  return (
    <div className="screenshots-page">
      <div className="screenshots-page__header">
        <div>
          <h1 className="screenshots-page__title">Screenshots</h1>
          <p className="screenshots-page__subtitle">
            {captures.length > 0
              ? `${captures.length} capture${captures.length === 1 ? '' : 's'}`
              : 'Capture screenshots from the extension side panel'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="screenshots-page__empty">
          <span className="screenshots-page__empty-text">Loading…</span>
        </div>
      ) : captures.length === 0 ? (
        <div className="screenshots-page__empty">
          <Camera size={40} className="screenshots-page__empty-icon" />
          <p className="screenshots-page__empty-text">No screenshots yet</p>
          <p className="screenshots-page__empty-hint">
            Open the extension side panel and use the Screenshot tab to capture
          </p>
        </div>
      ) : (
        <div className="screenshots-page__grid">
          {captures.map((capture) => (
            <ThumbnailCard
              key={capture.id}
              capture={capture}
              isDeleting={deletingId === capture.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
