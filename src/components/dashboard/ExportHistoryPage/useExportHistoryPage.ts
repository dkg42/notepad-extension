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
