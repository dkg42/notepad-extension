import { useEffect, useState } from 'react';
import type { ClipboardEntry } from '@/types';
import { clipboardSessionService } from '@/services/clipboard-session-service';
import { storageService } from '@/services/storage-service';

export function useClipboardTab() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);

  useEffect(() => {
    clipboardSessionService.getAll().then(setEntries);

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && 'clipboardEntries' in changes) {
        setEntries(changes['clipboardEntries'].newValue ?? []);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleDelete = async (id: string) => {
    await clipboardSessionService.remove(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClear = async () => {
    await clipboardSessionService.clear();
    setEntries([]);
  };

  const handleCopyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleSaveAsSnippet = async (entry: ClipboardEntry) => {
    if (entry.type === 'text' && entry.text) {
      await storageService.save(entry.text, entry.source);
    }
  };

  return { entries, handleDelete, handleClear, handleCopyText, handleSaveAsSnippet };
}
