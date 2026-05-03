/**
 * @module ScreenshotView
 * @description Sidebar view for the screenshot capture feature. Shows a usage bar, a 2×2 grid
 *   of capture-mode buttons, and a recent captures grid. When a mode button is clicked, the
 *   sidebar sends START_CAPTURE_MODE to the background (which injects a compact strip onto the
 *   active page via a content script) and then closes itself with window.close().
 * @dependencies useScreenshotView
 * @public ScreenshotView (default)
 */
import React, { useState } from 'react';
import {
  Monitor,
  Maximize2,
  Crop,
  MousePointer2,
  Info,
} from 'lucide-react';
import type { CaptureMode, CaptureRecord } from '@/types';
import { useScreenshotView } from './useScreenshotView';
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
  { id: 'visible',   Icon: Monitor,       label: 'Visible area', sub: 'What you see now' },
  { id: 'full',      Icon: Maximize2,     label: 'Full page',    sub: 'Entire scrollable page' },
  { id: 'selection', Icon: Crop,          label: 'Selection',    sub: 'Draw a region' },
  { id: 'element',   Icon: MousePointer2, label: 'Element',      sub: 'Pick a DOM node' },
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

function CaptureThumbnail({ capture }: { capture: CaptureRecord }) {
  return (
    <div className="screenshot-view__capture-thumb" title={capture.tabTitle}>
      <img
        className="screenshot-view__thumb-img"
        src={capture.dataUrl}
        alt={capture.tabTitle}
        loading="lazy"
      />
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
  const { captures, usedToday, dailyLimit } = useScreenshotView();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const limitReached = usedToday >= dailyLimit;
  const usagePct = Math.min(100, (usedToday / dailyLimit) * 100);
  const usageWarn = usagePct >= 80;

  const handleCapture = async (mode: CaptureMode) => {
    if (limitReached || launching) return;
    setLaunching(true);
    setLaunchError(null);
    const dark = localStorage.getItem('nh_dark_mode') === 'true';
    try {
      // Await the background response — it ensures the capture strip is fully
      // injected and visible on the page before this sidebar closes itself.
      const res = await chrome.runtime.sendMessage({
        type: 'START_CAPTURE_MODE',
        mode,
        dark,
      }) as { ok: boolean; error?: string } | undefined;

      if (res?.ok) {
        window.close();
      } else {
        setLaunchError(res?.error === 'no_active_tab'
          ? 'No active page found. Click on a page first.'
          : 'Could not start capture. Refresh the page and try again.');
        setLaunching(false);
      }
    } catch {
      setLaunchError('Could not reach the extension background. Try reloading the extension.');
      setLaunching(false);
    }
  };

  return (
    <div className="screenshot-view">
      {/* Usage bar */}
      <div className="screenshot-view__usage-row">
        <span className="screenshot-view__usage-label">
          {usedToday} of {dailyLimit} today
        </span>
        <div className="screenshot-view__usage-bar-track">
          <div
            className={`screenshot-view__usage-bar-fill${usageWarn ? ' screenshot-view__usage-bar-fill--warn' : ''}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <span className="screenshot-view__usage-count">{usedToday}/{dailyLimit}</span>
      </div>

      {/* Capture mode grid */}
      <div className="screenshot-view__mode-grid">
        {CAPTURE_MODES.map((cfg) => (
          <CaptureBtn
            key={cfg.id}
            config={cfg}
            disabled={limitReached || launching}
            onClick={() => void handleCapture(cfg.id)}
          />
        ))}
      </div>

      {/* Info note */}
      <div className="screenshot-view__info-note">
        <Info size={11} strokeWidth={1.8} style={{ flexShrink: 0, opacity: 0.6 }} />
        {launching ? 'Opening capture strip…' : 'Sidebar closes while capturing — reopen automatically when done'}
      </div>

      {/* Launch error */}
      {launchError && (
        <div className="screenshot-view__error-note">{launchError}</div>
      )}

      {/* Recent captures */}
      {captures.length > 0 && (
        <>
          <div className="screenshot-view__section-label">Recent captures</div>
          <div className="screenshot-view__captures-grid">
            {captures.slice(0, 4).map((c) => (
              <CaptureThumbnail key={c.id} capture={c} />
            ))}
          </div>
        </>
      )}

      {captures.length === 0 && (
        <div className="screenshot-view__empty">
          No captures yet — click a mode above to start.
        </div>
      )}
    </div>
  );
}
