/**
 * @module screenshot-handler
 * @description Handles screenshot chrome.runtime messages in the background service worker.
 *   START_CAPTURE_MODE: queries the active tab, injects SHOW_CAPTURE_STRIP into its content
 *     script, and sends the current usage so the strip can display it immediately.
 *   DO_CAPTURE: calls captureVisibleTab, compresses PNG→JPEG via OffscreenCanvas, persists
 *     the record, and responds with the capture + updated usage.
 *   GET_SCREENSHOT_STORE: returns the full persisted store to the sidebar.
 *   DELETE_CAPTURE: removes a stored capture by id.
 *   CAPTURE_STRIP_CLOSED: reopens the sidebar using chrome.sidePanel.open.
 * @dependencies screenshot-storage
 * @public handleScreenshotMessage
 */
import { screenshotStorage, FREE_DAILY_LIMIT } from '@/services/screenshot-storage';
import type { CaptureRecord, CaptureMode } from '@/types';

/** Compresses a PNG data URL to a smaller JPEG data URL via OffscreenCanvas. */
async function compressDataUrl(pngDataUrl: string): Promise<string> {
  const response = await fetch(pngDataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context from OffscreenCanvas');
  ctx.drawImage(bitmap, 0, 0);
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(jpegBlob);
  });
}

export function handleScreenshotMessage(
  message: { type: string } & Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): boolean | undefined {
  // ── START_CAPTURE_MODE ────────────────────────────────────────────────────
  // Sent by the sidebar before it closes. Queries the active tab, ensures the
  // capture-strip content script is injected (injecting it programmatically if
  // it is not yet loaded), then sends SHOW_CAPTURE_STRIP to the content script.
  // Responds { ok: true } only after the strip message is successfully delivered
  // so the sidebar can safely call window.close() after awaiting this response.
  if (message.type === 'START_CAPTURE_MODE') {
    const { mode } = message as { type: string; mode: CaptureMode };
    (async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) return { ok: false, error: 'no_active_tab' };

      const usage = await screenshotStorage.getUsage();

      const stripPayload = {
        type: 'SHOW_CAPTURE_STRIP',
        mode,
        windowId:   tab.windowId,
        usedToday:  usage.count,
        dailyLimit: FREE_DAILY_LIMIT,
        dark: message.dark ?? false,
      };

      // Try sending to an already-loaded content script first.
      // If the script is not yet injected on this tab (tab was open before
      // extension loaded), inject it programmatically then retry.
      try {
        await chrome.tabs.sendMessage(tab.id, stripPayload);
      } catch {
        // "Receiving end does not exist" — inject the script then send again.
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/capture-strip.js'],
        });
        // Give the script a tick to register its onMessage listener.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        await chrome.tabs.sendMessage(tab.id, stripPayload);
      }

      return { ok: true };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── DO_CAPTURE ────────────────────────────────────────────────────────────
  // Sent by the content script strip when the user clicks a capture mode button.
  // Only background can call captureVisibleTab.
  if (message.type === 'DO_CAPTURE') {
    const { mode } = message as { type: string; mode: CaptureMode };
    (async () => {
      const usage = await screenshotStorage.getUsage();
      if (usage.count >= FREE_DAILY_LIMIT) {
        return { ok: false, error: 'daily_limit_reached' };
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) return { ok: false, error: 'no_active_tab' };

      const pngDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId ?? 0, {
        format: 'png',
      });
      const dataUrl = await compressDataUrl(pngDataUrl);

      const capture: CaptureRecord = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mode,
        dataUrl,
        tabTitle: tab.title ?? 'Untitled',
        pageUrl: tab.url ?? '',
        capturedAt: Date.now(),
      };

      await screenshotStorage.addCapture(capture);
      const updated = await screenshotStorage.getUsage();

      return {
        ok: true,
        capture,
        usedToday: updated.count,
        dailyLimit: FREE_DAILY_LIMIT,
      };
    })()
      .then((r) => sendResponse(r))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  // ── CAPTURE_STRIP_CLOSED ──────────────────────────────────────────────────
  // Sent by the content script when the user clicks the exit button.
  // Reopens the sidebar for the same browser window.
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
