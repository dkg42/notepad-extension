/**
 * @module useScreenshotView
 * @description State hook for the Screenshot sidebar view. Loads the screenshot store from
 *   the background service worker, triggers captures via chrome.runtime messages, and manages
 *   the capturing / active-mode flags.
 * @dependencies @/types, screenshot-storage (FREE_DAILY_LIMIT constant only)
 * @public useScreenshotView
 */
import { useState, useEffect, useCallback } from 'react';
import type { CaptureRecord, CaptureMode, ScreenshotStore } from '@/types';

export const FREE_DAILY_LIMIT = 5;

export function useScreenshotView() {
  const [store, setStore] = useState<ScreenshotStore | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeMode, setActiveMode] = useState<CaptureMode | null>(null);
  const [lastCaptureError, setLastCaptureError] = useState<string | null>(null);

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

  const startCapture = useCallback(
    async (mode: CaptureMode): Promise<CaptureRecord | null> => {
      setIsCapturing(true);
      setActiveMode(mode);
      setLastCaptureError(null);
      try {
        const res = (await chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREENSHOT',
          mode,
        })) as { ok: boolean; capture?: CaptureRecord; error?: string };
        if (res?.ok && res.capture) {
          await loadStore();
          return res.capture;
        }
        setLastCaptureError(res?.error ?? 'unknown_error');
        return null;
      } catch (err) {
        setLastCaptureError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setIsCapturing(false);
        setActiveMode(null);
      }
    },
    [loadStore],
  );

  const deleteCapture = useCallback(
    async (id: string) => {
      await chrome.runtime.sendMessage({ type: 'DELETE_CAPTURE', id });
      await loadStore();
    },
    [loadStore],
  );

  return {
    store,
    captures: store?.captures ?? [],
    usedToday: store?.usage.count ?? 0,
    dailyLimit: FREE_DAILY_LIMIT,
    isCapturing,
    activeMode,
    lastCaptureError,
    startCapture,
    deleteCapture,
  };
}
