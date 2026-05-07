import { useCallback, useEffect, useState } from 'react';
import type { CaptureRecord, ScreenshotStore } from '@/types/screenshot';
import { useNavigation } from '@/contexts/NavigationContext';

export function useScreenshotsPage() {
  const { handleOpenScreenshotEditor } = useNavigation();
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCaptures = useCallback(() => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT_STORE' })
      .then((res: { ok: boolean; store?: ScreenshotStore }) => {
        setCaptures(res?.store?.captures ?? []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await chrome.runtime.sendMessage({ type: 'DELETE_CAPTURE', id });
      setCaptures((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleEdit = useCallback((id: string) => {
    handleOpenScreenshotEditor(id);
  }, [handleOpenScreenshotEditor]);

  return {
    captures,
    isLoading,
    deletingId,
    handleDelete,
    handleEdit,
  };
}
