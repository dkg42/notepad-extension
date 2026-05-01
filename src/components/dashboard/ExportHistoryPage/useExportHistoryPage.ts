/**
 * @module useExportHistoryPage
 * @description Hook for the Export History dashboard page that loads the persisted export log from storage on mount and exposes a clear handler that wipes the history and resets the local list.
 * @dependencies @/types/dashboard, @/services/storage-service
 * @public useExportHistoryPage
 */
import { useEffect, useState } from 'react';
import type { ExportRecord } from '@/types/dashboard';
import { storageService } from '@/services/storage-service';

export function useExportHistoryPage() {
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    setIsLoading(true);
    storageService.getExportHistory().then((h) => {
      setHistory(h);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    await storageService.clearExportHistory();
    setHistory([]);
  };

  return { history, isLoading, handleClear };
}
