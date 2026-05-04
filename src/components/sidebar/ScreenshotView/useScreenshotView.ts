/**
 * @module useScreenshotView
 * @description State hook for the Screenshot sidebar view. Loads the screenshot store from
 *   the background service worker and exposes captures and a deleteCapture action.
 * @dependencies @/types
 * @public useScreenshotView
 */
import { useState, useEffect, useCallback } from 'react';
import type { ScreenshotStore } from '@/types';

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

  return {
    captures: store?.captures ?? [],
    deleteCapture,
    loadStore,
  };
}
