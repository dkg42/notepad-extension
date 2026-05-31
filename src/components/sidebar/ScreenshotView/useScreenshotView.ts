/**
 * @module useScreenshotView
 * @description State hook for the Screenshot sidebar view. Loads the screenshot store from
 *   the background service worker and exposes captures, delete, download, and dashboard
 *   navigation actions.
 * @dependencies @/types
 * @public useScreenshotView
 */
import { useState, useEffect, useCallback } from 'react';
import type { CaptureRecord, ScreenshotStore } from '@/types';
import { openDashboard } from '@/utils/open-dashboard';
import { recentActionsStorage } from '@/services/storage/recent-actions-storage';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function timestampForFilename(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

export function useScreenshotView() {
  const [store, setStore] = useState<ScreenshotStore | null>(null);

  const loadStore = useCallback(async () => {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT_STORE' })) as {
        ok: boolean;
        store?: ScreenshotStore;
      };
      if (res?.ok && res.store) setStore(res.store);
    } catch {
      // non-fatal — store stays null and UI shows empty state
    }
  }, []);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const deleteCapture = useCallback(
    async (id: string) => {
      await chrome.runtime.sendMessage({ type: 'DELETE_CAPTURE', id });
      await loadStore();
    },
    [loadStore],
  );

  const downloadCapture = useCallback((capture: CaptureRecord) => {
    const filename = `screenshot-${timestampForFilename(capture.capturedAt)}.jpg`;
    const a = document.createElement('a');
    a.href = capture.dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    void recentActionsStorage.addRecentAction({
      featureId: 'screenshot',
      kind: 'screenshot_saved',
      label: `Saved screenshot: ${filename}`,
    });
  }, []);

  const openInDashboard = useCallback(async (captureId: string) => {
    await chrome.storage.local.set({
      pendingDashboardNav: { view: 'screenshot-editor', captureId },
    });
    await openDashboard();
  }, []);

  return {
    captures: store?.captures ?? [],
    deleteCapture,
    downloadCapture,
    openInDashboard,
    loadStore,
  };
}
