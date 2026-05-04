/**
 * @module capture-strip.content
 * @description Content script for interactive screenshot capture modes (selection, element,
 *   scrollable). Injected on demand by the background when one of these modes is started.
 *   Renders overlays directly on the page using shadow DOM for style isolation. The simpler
 *   "visible" mode is handled entirely in the background without a content script.
 * @dependencies none
 * @public (WXT content script default export)
 */
import { defineContentScript } from 'wxt/sandbox';

// ─── Scrollable overlay CSS ───────────────────────────────────────────────────

const OVERLAY_CSS = `
  :host {
    all: initial;
    position: fixed !important;
    bottom: 24px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483646 !important;
    pointer-events: auto !important;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .overlay {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(18,18,28,0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 18px;
    padding: 8px 12px 8px 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    white-space: nowrap;
    user-select: none;
  }
  .preview {
    width: 54px;
    height: 38px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.12);
    background: #111;
    flex-shrink: 0;
  }
  .preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .info { display: flex; flex-direction: column; gap: 2px; min-width: 90px; }
  .count { font-size: 11.5px; font-weight: 600; color: #fff; }
  .hint { font-size: 9.5px; color: rgba(255,255,255,0.42); font-family: "JetBrains Mono","SF Mono",monospace; }
  .actions { display: flex; align-items: center; gap: 6px; }
  .btn {
    height: 30px;
    padding: 0 13px;
    border-radius: 9px;
    border: none;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    transition: opacity 0.1s, background 0.1s;
  }
  .btn:disabled { opacity: 0.38; cursor: not-allowed; }
  .btn-scroll { background: oklch(0.585 0.18 270); color: #fff; }
  .btn-scroll:hover:not(:disabled) { background: oklch(0.630 0.18 270); }
  .btn-save { background: oklch(0.600 0.17 145); color: #fff; }
  .btn-save:hover:not(:disabled) { background: oklch(0.650 0.17 145); }
  .btn-cancel { width: 30px; padding: 0; background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.65); font-size: 15px; }
  .btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
`;

// ─── Module state ─────────────────────────────────────────────────────────────

let overlayHost: HTMLElement | null = null;
let windowId = 0;
let isInteracting = false;

// ─── Overlay helpers ──────────────────────────────────────────────────────────

function destroyOverlay() {
  if (overlayHost) { overlayHost.remove(); overlayHost = null; }
}

interface OverlayController {
  setPreview: (dataUrl: string) => void;
  setProgress: (sections: number, heightPx: number) => void;
  setScrollEnabled: (enabled: boolean) => void;
  setAllDisabled: (disabled: boolean) => void;
  setSaving: (saving: boolean) => void;
  onScrollMore: (handler: () => void) => void;
  onSave: (handler: () => void) => void;
  onCancel: (handler: () => void) => void;
}

function buildScrollableOverlay(): OverlayController {
  destroyOverlay();

  const host = document.createElement('div');
  host.id = 'nh-scroll-overlay-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = OVERLAY_CSS;
  shadow.appendChild(styleEl);

  const overlay   = document.createElement('div');
  overlay.className = 'overlay';

  const preview   = document.createElement('div');
  preview.className = 'preview';

  const info      = document.createElement('div');
  info.className  = 'info';
  const count     = document.createElement('div');
  count.className = 'count';
  count.textContent = '1 section';
  const hint      = document.createElement('div');
  hint.className  = 'hint';
  hint.textContent = 'scroll to capture more';
  info.appendChild(count);
  info.appendChild(hint);

  const actions   = document.createElement('div');
  actions.className = 'actions';

  const btnScroll  = document.createElement('button');
  btnScroll.className = 'btn btn-scroll';
  btnScroll.textContent = 'Scroll ↓';

  const btnSave    = document.createElement('button');
  btnSave.className = 'btn btn-save';
  btnSave.textContent = 'Save';

  const btnCancel  = document.createElement('button');
  btnCancel.className = 'btn btn-cancel';
  btnCancel.textContent = '✕';

  actions.appendChild(btnScroll);
  actions.appendChild(btnSave);
  actions.appendChild(btnCancel);
  overlay.appendChild(preview);
  overlay.appendChild(info);
  overlay.appendChild(actions);
  shadow.appendChild(overlay);

  overlayHost = host;
  document.body.appendChild(host);

  return {
    setPreview(dataUrl: string) {
      preview.innerHTML = `<img src="${dataUrl}" alt="capture preview" />`;
    },
    setProgress(sections: number, heightPx: number) {
      count.textContent = `${sections} ${sections === 1 ? 'section' : 'sections'}`;
      hint.textContent  = `~${Math.round(heightPx)}px captured`;
    },
    setScrollEnabled(enabled: boolean) {
      btnScroll.disabled = !enabled;
    },
    setAllDisabled(disabled: boolean) {
      btnScroll.disabled = disabled;
      btnSave.disabled   = disabled;
      btnCancel.disabled = disabled;
    },
    setSaving(saving: boolean) {
      btnSave.textContent = saving ? 'Saving…' : 'Save';
    },
    onScrollMore(handler: () => void) { btnScroll.addEventListener('click', handler); },
    onSave(handler: () => void)       { btnSave.addEventListener('click', handler); },
    onCancel(handler: () => void)     { btnCancel.addEventListener('click', handler); },
  };
}

// ─── Crop overlays ────────────────────────────────────────────────────────────

type CropRect = { x: number; y: number; width: number; height: number };

function startSelectionOverlay(): Promise<CropRect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;-webkit-user-select:none;user-select:none;';

    const selBox = document.createElement('div');
    selBox.style.cssText = 'position:fixed;display:none;border:2px solid oklch(0.585 0.18 270);background:rgba(124,58,237,0.08);box-shadow:0 0 0 9999px rgba(0,0,0,0.35);box-sizing:border-box;pointer-events:none;';
    overlay.appendChild(selBox);

    let startX = 0, startY = 0, drawing = false;

    const onDown = (e: MouseEvent) => {
      drawing = true;
      startX = e.clientX;
      startY = e.clientY;
      selBox.style.cssText += 'display:block;';
      selBox.style.left = `${startX}px`;
      selBox.style.top  = `${startY}px`;
      selBox.style.width  = '0';
      selBox.style.height = '0';
    };

    const onMove = (e: MouseEvent) => {
      if (!drawing) return;
      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      selBox.style.left   = `${x}px`;
      selBox.style.top    = `${y}px`;
      selBox.style.width  = `${Math.abs(e.clientX - startX)}px`;
      selBox.style.height = `${Math.abs(e.clientY - startY)}px`;
    };

    const cleanup = () => {
      overlay.removeEventListener('mousedown', onDown);
      overlay.removeEventListener('mousemove', onMove);
      overlay.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };

    const onUp = (e: MouseEvent) => {
      if (!drawing) return;
      drawing = false;
      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      cleanup();
      resolve(w < 10 || h < 10 ? null : { x, y, width: w, height: h });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };

    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}

function startElementPicker(): Promise<CropRect | null> {
  return new Promise((resolve) => {
    let highlighted: HTMLElement | null = null;

    document.documentElement.style.cursor = 'crosshair';

    const onMove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target || target === highlighted) return;
      if (highlighted) highlighted.style.outline = '';
      highlighted = target;
      highlighted.style.outline = '2px solid oklch(0.585 0.18 270)';
    };

    const cleanup = () => {
      document.documentElement.style.cursor = '';
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      if (highlighted) { highlighted.style.outline = ''; highlighted = null; }
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      cleanup();
      if (!target) { resolve(null); return; }
      const r = target.getBoundingClientRect();
      resolve({ x: r.left, y: r.top, width: r.width, height: r.height });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
  });
}

// ─── Capture handlers ─────────────────────────────────────────────────────────

async function finishCapture() {
  isInteracting = false;
  destroyOverlay();
  try {
    await chrome.runtime.sendMessage({ type: 'CAPTURE_STRIP_CLOSED', windowId });
  } catch { /* sidebar already reopened or context gone */ }
}

async function handleSelection() {
  const cropRect = await startSelectionOverlay();
  if (!cropRect) { await finishCapture(); return; }

  await new Promise<void>((r) => setTimeout(r, 100));

  try {
    await chrome.runtime.sendMessage({
      type: 'DO_CAPTURE',
      mode: 'selection',
      cropRect,
      devicePixelRatio: window.devicePixelRatio || 1,
      windowId,
      tabTitle: document.title,
      pageUrl:  location.href,
    });
  } catch { /* ignore */ }

  await finishCapture();
}

async function handleElement() {
  const cropRect = await startElementPicker();
  if (!cropRect) { await finishCapture(); return; }

  await new Promise<void>((r) => setTimeout(r, 100));

  try {
    await chrome.runtime.sendMessage({
      type: 'DO_CAPTURE',
      mode: 'element',
      cropRect,
      devicePixelRatio: window.devicePixelRatio || 1,
      windowId,
      tabTitle: document.title,
      pageUrl:  location.href,
    });
  } catch { /* ignore */ }

  await finishCapture();
}

async function handleScrollable() {
  const savedScrollY   = window.scrollY;
  const viewportHeight = window.innerHeight;
  const viewportWidth  = window.innerWidth;
  const dpr            = window.devicePixelRatio || 1;
  const maxScrollY     = Math.max(0, document.documentElement.scrollHeight - viewportHeight);

  let firstRes: { ok: boolean; pngDataUrl?: string; error?: string };
  try {
    firstRes = (await chrome.runtime.sendMessage({ type: 'CAPTURE_SLICE', windowId })) as typeof firstRes;
  } catch {
    await finishCapture(); return;
  }
  if (!firstRes.ok || !firstRes.pngDataUrl) { await finishCapture(); return; }

  let currentY = savedScrollY;
  const slices: Array<{ pngDataUrl: string; scrollY: number }> = [
    { pngDataUrl: firstRes.pngDataUrl, scrollY: currentY },
  ];

  const overlay = buildScrollableOverlay();
  overlay.setPreview(firstRes.pngDataUrl);
  overlay.setProgress(1, viewportHeight);
  overlay.setScrollEnabled(currentY < maxScrollY);

  overlay.onScrollMore(async () => {
    overlay.setAllDisabled(true);

    currentY = Math.min(currentY + viewportHeight, maxScrollY);
    window.scrollTo({ top: currentY, behavior: 'instant' });
    await new Promise<void>((r) => setTimeout(r, 150));

    try {
      const r = (await chrome.runtime.sendMessage({ type: 'CAPTURE_SLICE', windowId })) as {
        ok: boolean; pngDataUrl?: string;
      };
      if (r.ok && r.pngDataUrl) {
        slices.push({ pngDataUrl: r.pngDataUrl, scrollY: currentY });
        overlay.setPreview(r.pngDataUrl);
        overlay.setProgress(slices.length, (currentY + viewportHeight) - slices[0].scrollY);
      }
    } catch { /* leave previous preview intact on transient error */ }

    overlay.setAllDisabled(false);
    overlay.setScrollEnabled(currentY < maxScrollY && slices.length < 30);
  });

  overlay.onSave(async () => {
    overlay.setAllDisabled(true);
    overlay.setSaving(true);

    const originY          = slices[0].scrollY;
    const normalizedSlices = slices.map((s) => ({ ...s, scrollY: s.scrollY - originY }));
    const capturedHeight   = (slices[slices.length - 1].scrollY - originY) + viewportHeight;

    try {
      await chrome.runtime.sendMessage({
        type: 'STITCH_AND_STORE',
        slices: normalizedSlices,
        viewportWidth,
        viewportHeight,
        totalScrollHeight: capturedHeight,
        dpr,
        windowId,
        tabTitle: document.title,
        pageUrl:  location.href,
      });
    } catch { /* ignore */ }

    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    await finishCapture();
  });

  overlay.onCancel(async () => {
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    await finishCapture();
  });
}

// ─── WXT entrypoint ──────────────────────────────────────────────────────────

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type !== 'SHOW_INTERACTIVE_CAPTURE') return;
      if (isInteracting) return;

      isInteracting = true;
      windowId = (message.windowId as number) ?? 0;

      const mode = message.mode as string;
      if      (mode === 'selection')  void handleSelection();
      else if (mode === 'element')    void handleElement();
      else if (mode === 'scrollable') void handleScrollable();
      else                            void finishCapture();
    });
  },
});
