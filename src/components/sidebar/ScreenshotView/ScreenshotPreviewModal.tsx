/**
 * @module ScreenshotPreviewModal
 * @description Sidebar modal that previews a screenshot at full size and exposes
 *   Edit-in-dashboard and Download actions. Closes on overlay click, close button,
 *   or Escape key.
 * @dependencies @/types
 * @public ScreenshotPreviewModal (default)
 */
import React, { useEffect } from 'react';
import { Pencil, Download, X } from 'lucide-react';
import type { CaptureRecord } from '@/types';
import './ScreenshotPreviewModal.css';

interface ScreenshotPreviewModalProps {
  capture: CaptureRecord;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDownload: (capture: CaptureRecord) => void;
}

export default function ScreenshotPreviewModal({
  capture,
  onClose,
  onEdit,
  onDownload,
}: ScreenshotPreviewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="screenshot-preview__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="screenshot-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Screenshot preview"
      >
        <div className="screenshot-preview__header">
          <div className="screenshot-preview__title" title={capture.tabTitle}>
            {capture.tabTitle || 'Untitled'}
          </div>
          <button
            className="screenshot-preview__close"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            type="button"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <div className="screenshot-preview__image-wrap">
          <img
            className="screenshot-preview__image"
            src={capture.dataUrl}
            alt={capture.tabTitle}
          />
        </div>

        <div className="screenshot-preview__footer">
          <button
            className="screenshot-preview__btn screenshot-preview__btn--secondary"
            onClick={() => onDownload(capture)}
            type="button"
          >
            <Download size={13} strokeWidth={2} />
            Download
          </button>
          <button
            className="screenshot-preview__btn screenshot-preview__btn--primary"
            onClick={() => onEdit(capture.id)}
            type="button"
          >
            <Pencil size={13} strokeWidth={2} />
            Edit in dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
