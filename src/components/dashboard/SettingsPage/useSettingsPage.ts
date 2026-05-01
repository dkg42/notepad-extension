/**
 * @module useSettingsPage
 * @description Hook for the Settings dashboard page providing data export (JSON download), JSON file import with validation, and a two-step clear-all flow that reloads the page after storage is wiped.
 * @dependencies @/types/dashboard, @/services/storage-service
 * @public useSettingsPage
 */
import { useState } from 'react';
import type { DashboardSettings } from '@/types/dashboard';
import { storageService } from '@/services/storage-service';

export function useSettingsPage(
  settings: DashboardSettings,
  onSettingsChange: (s: Partial<DashboardSettings>) => void,
) {
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = async () => {
    const data = await storageService.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-enhancer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    setImportError('');
    setImportSuccess('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as Record<string, unknown>;
        await storageService.importAllData(data);
        setImportSuccess('Data imported successfully. Reload the page to see changes.');
      } catch {
        setImportError('Failed to import: invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    await storageService.clear();
    setShowClearConfirm(false);
    window.location.reload();
  };

  return {
    importError,
    importSuccess,
    showClearConfirm,
    setShowClearConfirm,
    handleExport,
    handleImport,
    handleClearAll,
  };
}
