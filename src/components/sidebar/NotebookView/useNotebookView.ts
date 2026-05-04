/**
 * @module useNotebookView
 * @description Hook for the Add to NotebookLM sidebar view. Owns all async logic:
 *   fetches the active tab URL, loads cached notebooks from storage, triggers syncs,
 *   and submits the ADD_SOURCE_URL background message.
 * @dependencies notebookSyncService, @/types
 * @public useNotebookView
 */
import { useState, useEffect, useCallback } from 'react';
import type { NotebookMeta } from '@/types';
import { notebookSyncService } from '@/services/notebook-sync-service';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const INTERNAL_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'edge://'];

function isAddableUrl(url: string | undefined): url is string {
  if (!url) return false;
  return !INTERNAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function useNotebookView() {
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const [tabTitle, setTabTitle] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      notebookSyncService.getAll(),
    ]).then(([tabs, stored]) => {
      const tab = tabs[0];
      setTabUrl(isAddableUrl(tab?.url) ? (tab.url ?? null) : null);
      setTabTitle(tab?.title ?? null);
      setNotebooks(stored);
    });
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'SYNC_NOTEBOOKS' });
      const fresh = await notebookSyncService.getAll();
      setNotebooks(fresh);
    } catch {
      // Preserve existing list on failure
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!tabUrl || !selectedId) return;
    setStatus('submitting');
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'ADD_SOURCE_URL',
        notebookId: selectedId,
        url: tabUrl,
      })) as { ok: boolean; error?: string } | undefined;

      if (res?.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(res?.error ?? 'Unknown error');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [tabUrl, selectedId]);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMsg(null);
  }, []);

  return {
    tabUrl,
    tabTitle,
    notebooks,
    isSyncing,
    selectedId,
    selectNotebook: setSelectedId,
    handleSync,
    handleSubmit,
    status,
    errorMsg,
    reset,
  };
}
