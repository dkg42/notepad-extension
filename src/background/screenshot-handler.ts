/**
 * @module screenshot-handler
 * @description Handles screenshot chrome.runtime messages in the background service worker.
 *   START_CAPTURE_MODE: queries the active tab. For 'visible' captures directly; for
 *     interactive modes closes the sidebar and injects the capture overlay content script.
 *   DO_CAPTURE: calls captureVisibleTab, compresses PNG→JPEG via OffscreenCanvas, persists.
 *   CAPTURE_SLICE: captures current viewport and returns the raw PNG (used by scrollable mode).
 *   STITCH_AND_STORE: stitches collected slices into one image, compresses, persists.
 *   GET_SCREENSHOT_STORE: returns the full persisted store to the sidebar.
 *   DELETE_CAPTURE: removes a stored capture by id.
 *   CAPTURE_STRIP_CLOSED: reopens the sidebar using chrome.sidePanel.open.
 * @dependencies screenshot-storage
 * @public handleScreenshotMessage
 */
import { screenshotStorage } from '@/services/screenshot-storage';
import type { CaptureRecord, CaptureMode } from '@/types';

/** Converts a data URL to a Blob without using fetch (avoids CSP connect-src restrictions). */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

/** Converts a Blob to a data URL without FileReader (unavailable in service workers). */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...(bytes.subarray(i, i + chunkSize) as unknown as number[])));
  }
  return `data:${blob.type};base64,${btoa(chunks.join(''))}`;
}

/** Compresses a PNG data URL to a smaller JPEG data URL via OffscreenCanvas. */
async function compressDataUrl(pngDataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(pngDataUrl);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context from OffscreenCanvas');
  ctx.drawImage(bitmap, 0, 0);
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  return blobToDataUrl(jpegBlob);
}

/** Crops a PNG data URL to the given CSS-pixel rect (scaled by dpr) and compresses to JPEG. */
async function cropAndCompressDataUrl(
  pngDataUrl: string,
  crop: { x: number; y: number; width: number; height: number },
  dpr: number,
): Promise<string> {
  const blob = dataUrlToBlob(pngDataUrl);
  const bitmap = await createImageBitmap(blob);
  const sx = Math.round(crop.x * dpr);
  const sy = Math.round(crop.y * dpr);
  const sw = Math.round(crop.width * dpr);
  const sh = Math.round(crop.height * dpr);
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context from OffscreenCanvas');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  return blobToDataUrl(jpegBlob);
}

export function handleScreenshotMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── START_CAPTURE_MODE ────────────────────────────────────────────────────
  // Sent by the sidebar when the user selects a capture mode.
  //
  // 'visible': capture immediately while the sidebar stays open (captureVisibleTab
  //   only captures the tab's WebContents, not the side-panel chrome), then respond
  //   so the sidebar can refresh its captures list without closing.
  //
  // Interactive modes (selection / element / scrollable): close the sidebar so the
  //   full page is visible, inject the content script overlay, respond immediately.
  //   The content script sends CAPTURE_STRIP_CLOSED when done to reopen the sidebar.
  if (message.type === 'START_CAPTURE_MODE') {
    const { mode } = message as { type: string; mode: CaptureMode };
    (async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) return sendResponse({ ok: false, error: 'no_active_tab' });

      if (mode === 'visible') {
        // Capture directly — no sidebar close needed.
        const pngDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        const dataUrl = await compressDataUrl(pngDataUrl);
        const capture: CaptureRecord = {
          id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          mode: 'visible',
          dataUrl,
          tabTitle: tab.title ?? 'Untitled',
          pageUrl:  tab.url  ?? '',
          capturedAt: Date.now(),
        };
        await screenshotStorage.addCapture(capture);
        return sendResponse({ ok: true, capture });
      }

      // Interactive mode — close sidebar, show overlay on the page.
      try {
        await (chrome.sidePanel as unknown as {
          close: (opts: { windowId: number }) => Promise<void>;
        }).close({ windowId: tab.windowId });
      } catch { /* ignore on older Chrome */ }

      const payload = { type: 'SHOW_INTERACTIVE_CAPTURE', mode, windowId: tab.windowId };
      try {
        await chrome.tabs.sendMessage(tab.id, payload);
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/capture-strip.js'],
        });
        await new Promise<void>((r) => setTimeout(r, 50));
        await chrome.tabs.sendMessage(tab.id, payload);
      }

      sendResponse({ ok: true });
    })()
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── CAPTURE_SLICE ─────────────────────────────────────────────────────────
  // Sent by the strip during a scrollable capture. Returns the raw PNG for the
  // current viewport without compressing or storing.
  if (message.type === 'CAPTURE_SLICE') {
    const { windowId: sliceWindowId } = message as { type: string; windowId: number };
    (async () => {
      const pngDataUrl = await chrome.tabs.captureVisibleTab(sliceWindowId ?? 0, { format: 'png' });
      return { ok: true, pngDataUrl };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── STITCH_AND_STORE ──────────────────────────────────────────────────────
  // Sent after all slices are collected. Stitches them into one tall image via
  // OffscreenCanvas, compresses to JPEG, and persists.
  if (message.type === 'STITCH_AND_STORE') {
    const {
      slices,
      viewportWidth,
      viewportHeight: _viewportHeight,
      totalScrollHeight,
      dpr,
      tabTitle,
      pageUrl,
    } = message as {
      type: string;
      slices: Array<{ pngDataUrl: string; scrollY: number }>;
      viewportWidth: number;
      viewportHeight: number;
      totalScrollHeight: number;
      dpr: number;
      windowId?: number;
      tabTitle?: string;
      pageUrl?: string;
    };
    void _viewportHeight;
    (async () => {
      const physWidth  = Math.round(viewportWidth * dpr);
      const physHeight = Math.round(totalScrollHeight * dpr);
      const canvas = new OffscreenCanvas(physWidth, physHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2d context from OffscreenCanvas');

      for (const slice of slices) {
        const blob   = dataUrlToBlob(slice.pngDataUrl);
        const bitmap = await createImageBitmap(blob);
        const yOffset = Math.round(slice.scrollY * dpr);
        ctx.drawImage(bitmap, 0, yOffset);
        bitmap.close();
      }

      const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
      const dataUrl  = await blobToDataUrl(jpegBlob);

      const capture: CaptureRecord = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mode: 'scrollable',
        dataUrl,
        tabTitle: tabTitle ?? 'Untitled',
        pageUrl: pageUrl ?? '',
        capturedAt: Date.now(),
      };

      await screenshotStorage.addCapture(capture);
      return { ok: true, capture };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) => {
        console.error('[STITCH_AND_STORE] error:', err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true;
  }

  // ── DO_CAPTURE ────────────────────────────────────────────────────────────
  // Sent by the content script strip when the user clicks a capture mode button.
  // Only background can call captureVisibleTab.
  if (message.type === 'DO_CAPTURE') {
    const { mode, cropRect, devicePixelRatio, windowId: captureWindowId, tabTitle, pageUrl } = message as {
      type: string;
      mode: CaptureMode;
      cropRect?: { x: number; y: number; width: number; height: number };
      devicePixelRatio?: number;
      windowId?: number;
      tabTitle?: string;
      pageUrl?: string;
    };
    (async () => {
      const pngDataUrl = await chrome.tabs.captureVisibleTab(captureWindowId ?? 0, {
        format: 'png',
      });
      const dataUrl =
        cropRect && cropRect.width > 0 && cropRect.height > 0
          ? await cropAndCompressDataUrl(pngDataUrl, cropRect, devicePixelRatio ?? 1)
          : await compressDataUrl(pngDataUrl);

      const capture: CaptureRecord = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mode,
        dataUrl,
        tabTitle: tabTitle ?? 'Untitled',
        pageUrl: pageUrl ?? '',
        capturedAt: Date.now(),
      };

      await screenshotStorage.addCapture(capture);
      return { ok: true, capture };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) => {
        console.error('[DO_CAPTURE] error:', err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true;
  }

  // ── CAPTURE_STRIP_CLOSED ──────────────────────────────────────────────────
  // Sent by the content script when the user clicks the exit button.
  if (message.type === 'CAPTURE_STRIP_CLOSED') {
    const { windowId } = message as { type: string; windowId: number };
    (async () => {
      if (windowId) {
        await (chrome.sidePanel as unknown as {
          open: (opts: { windowId: number }) => Promise<void>;
        }).open({ windowId });
      }
      return { ok: true };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── GET_SCREENSHOT_STORE ──────────────────────────────────────────────────
  if (message.type === 'GET_SCREENSHOT_STORE') {
    screenshotStorage
      .getStore()
      .then((store) => sendResponse({ ok: true, store }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── DELETE_CAPTURE ────────────────────────────────────────────────────────
  if (message.type === 'DELETE_CAPTURE') {
    const { id } = message as { type: string; id: string };
    screenshotStorage
      .deleteCapture(id)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  return undefined;
}
