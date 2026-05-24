/**
 * @module ScreenshotView
 * @description Sidebar view for the screenshot capture feature. Shows a 2×2 grid of
 *   capture-mode buttons and a scrollable grid of all saved captures with delete buttons.
 * @dependencies useScreenshotView
 * @public ScreenshotView (default)
 */
import React, { useState } from 'react';
import {
  Monitor,
  ScrollText,
  Crop,
  MousePointer2,
  X,
} from 'lucide-react';
import type { CaptureMode, CaptureRecord } from '@/types';
import { useScreenshotView } from './useScreenshotView';
import ScreenshotPreviewModal from './ScreenshotPreviewModal';
import './ScreenshotView.css';

// ─────────────────────────────────────────────────────────────────────────────
// Capture mode metadata
// ─────────────────────────────────────────────────────────────────────────────

interface ModeConfig {
  id: CaptureMode;
  Icon: React.ElementType;
  label: string;
  sub: string;
}

const CAPTURE_MODES: ModeConfig[] = [
  { id: 'visible',    Icon: Monitor,       label: 'Visible area', sub: 'What you see now' },
  { id: 'scrollable', Icon: ScrollText,    label: 'Scrollable',   sub: 'Scroll & stitch' },
  { id: 'selection',  Icon: Crop,          label: 'Selection',    sub: 'Draw a region' },
  { id: 'element',    Icon: MousePointer2, label: 'Element',      sub: 'Pick a DOM node' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function modeLabel(mode: CaptureMode): string {
  return CAPTURE_MODES.find((m) => m.id === mode)?.label ?? mode;
}

// ─────────────────────────────────────────────────────────────────────────────
// CaptureBtn subcomponent
// ─────────────────────────────────────────────────────────────────────────────

interface CaptureBtnProps {
  config: ModeConfig;
  disabled: boolean;
  onClick: () => void;
}

function CaptureBtn({ config, disabled, onClick }: CaptureBtnProps) {
  const { Icon, label, sub } = config;
  return (
    <button
      className={`screenshot-view__mode-btn${disabled ? ' screenshot-view__mode-btn--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon size={16} className="screenshot-view__mode-icon" strokeWidth={1.7} />
      <div>
        <div className="screenshot-view__mode-label">{label}</div>
        <div className="screenshot-view__mode-sub">{sub}</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CaptureThumbnail subcomponent
// ─────────────────────────────────────────────────────────────────────────────

function CaptureThumbnail({
  capture,
  onDelete,
  onOpen,
}: {
  capture: CaptureRecord;
  onDelete: (id: string) => void;
  onOpen: (capture: CaptureRecord) => void;
}) {
  return (
    <div
      className="screenshot-view__capture-thumb"
      title={capture.tabTitle}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(capture)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(capture);
        }
      }}
    >
      <img
        className="screenshot-view__thumb-img"
        src={capture.dataUrl}
        alt={capture.tabTitle}
        loading="lazy"
      />
      <button
        className="screenshot-view__thumb-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(capture.id);
        }}
        title="Delete capture"
        aria-label="Delete capture"
      >
        <X size={10} strokeWidth={2.5} />
      </button>
      <div className="screenshot-view__thumb-meta">
        <div className="screenshot-view__thumb-name">
          {modeLabel(capture.mode)} — {capture.tabTitle || 'Untitled'}
        </div>
        <div className="screenshot-view__thumb-time">{timeAgo(capture.capturedAt)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScreenshotView
// ─────────────────────────────────────────────────────────────────────────────

export default function ScreenshotView() {
  const {
    captures,
    deleteCapture,
    downloadCapture,
    openInDashboard,
    loadStore,
  } = useScreenshotView();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [previewCapture, setPreviewCapture] = useState<CaptureRecord | null>(null);

  const handleCapture = async (mode: CaptureMode) => {
    if (launching) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      const raw = await chrome.runtime.sendMessage({ type: 'START_CAPTURE_MODE', mode });
      const res = raw as { ok: boolean; error?: string } | undefined;

      if (res && !res.ok) {
        setLaunchError(res.error === 'no_active_tab'
          ? 'No active page found. Click on a page first.'
          : 'Could not start capture. Refresh the page and try again.');
      } else if (mode === 'visible') {
        // Sidebar stays open for visible captures — refresh the list.
        await loadStore();
      }
      // For interactive modes the sidebar is closed by the background;
      // the port closing causes an exception that is swallowed below.
    } catch {
      // Port closed mid-message: normal when background closes the sidebar.
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="screenshot-view">
      {/* Capture mode grid */}
      <div className="screenshot-view__mode-grid">
        {CAPTURE_MODES.map((cfg) => (
          <CaptureBtn
            key={cfg.id}
            config={cfg}
            disabled={launching}
            onClick={() => void handleCapture(cfg.id)}
          />
        ))}
      </div>

      {/* Launch error */}
      {launchError && (
        <div className="screenshot-view__error-note">{launchError}</div>
      )}

      {/* Captures */}
      {captures.length > 0 && (
        <>
          <div className="screenshot-view__section-label">
            Captures ({captures.length})
          </div>
          <div className="screenshot-view__captures-grid">
            {captures.map((c) => (
              <CaptureThumbnail
                key={c.id}
                capture={c}
                onDelete={deleteCapture}
                onOpen={setPreviewCapture}
              />
            ))}
          </div>
        </>
      )}

      {captures.length === 0 && (
        <div className="screenshot-view__empty">
          No captures yet — click a mode above to start.
        </div>
      )}

      {previewCapture && (
        <ScreenshotPreviewModal
          capture={previewCapture}
          onClose={() => setPreviewCapture(null)}
          onEdit={(id) => {
            setPreviewCapture(null);
            void openInDashboard(id);
          }}
          onDownload={downloadCapture}
        />
      )}
    </div>
  );
}
