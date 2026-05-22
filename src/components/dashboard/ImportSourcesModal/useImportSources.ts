/**
 * @module useImportSources
 * @description Hook for the Import Sources modal managing tabbed import modes (URL, crawler, CSV, RSS, tabs). Handles single-URL adds, bulk imports with 500 ms progress polling, domain-router rule application to split URLs across notebooks, and job cancellation.
 * @dependencies @/types, @/services/domain-router-service
 * @public useImportSources, ImportTab
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BulkImportProgress, DomainRouterRule } from '@/types';
import { domainRouterService, routeUrls } from '@/services/domain-router-service';

export type ImportTab = 'url' | 'crawler' | 'csv' | 'rss' | 'tabs';

interface JobProgress extends BulkImportProgress {
  status: 'pending' | 'running' | 'completed' | 'cancelled';
}

export function useImportSources(notebookId: string) {
  const [activeTab, setActiveTab] = useState<ImportTab>('url');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single URL add state (preserves old behavior)
  const [singleUrl, setSingleUrl] = useState('');
  const [singleUrlError, setSingleUrlError] = useState<string | null>(null);
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollProgress = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'GET_IMPORT_JOB_PROGRESS',
          jobId: id,
        }) as { ok: boolean; progress?: JobProgress };

        if (result?.ok && result.progress) {
          setProgress(result.progress);
          if (result.progress.status === 'completed' || result.progress.status === 'cancelled') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setIsImporting(false);
          }
        }
      } catch {
        // Keep polling
      }
    }, 500);
  }, []);

  /** Starts a bulk import, applying domain router rules to split URLs across notebooks. */
  const startBulkImport = useCallback(async (urls: string[]) => {
    if (urls.length === 0) return;
    setIsImporting(true);
    setProgress(null);

    try {
      // Load domain router rules and apply them
      const rules = await domainRouterService.getRules();
      const enabledRules = rules.filter((r: DomainRouterRule) => r.enabled);

      if (enabledRules.length > 0) {
        const groups = routeUrls(urls, enabledRules, notebookId);
        // Start a job for each target notebook
        for (const [targetNotebookId, groupUrls] of groups) {
          const result = await chrome.runtime.sendMessage({
            type: 'BULK_ADD_SOURCES',
            notebookId: targetNotebookId,
            urls: groupUrls,
          }) as { ok: boolean; jobId?: string; error?: string };

          // Track the job for the current notebook (primary)
          if (targetNotebookId === notebookId && result?.ok && result.jobId) {
            setJobId(result.jobId);
            pollProgress(result.jobId);
          }
        }
      } else {
        // No rules — import all to current notebook
        const result = await chrome.runtime.sendMessage({
          type: 'BULK_ADD_SOURCES',
          notebookId,
          urls,
        }) as { ok: boolean; jobId?: string; error?: string };

        if (result?.ok && result.jobId) {
          setJobId(result.jobId);
          pollProgress(result.jobId);
        } else {
          setIsImporting(false);
        }
      }
    } catch {
      setIsImporting(false);
    }
  }, [notebookId, pollProgress]);

  const cancelImport = useCallback(async () => {
    if (!jobId) return;
    await chrome.runtime.sendMessage({
      type: 'CANCEL_IMPORT_JOB',
      jobId,
    });
  }, [jobId]);

  /** Adds a single URL (preserves the original inline add behavior). */
  const addSingleUrl = useCallback(async (url: string): Promise<boolean> => {
    setIsAddingSingle(true);
    setSingleUrlError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'ADD_SOURCE_URL',
        notebookId,
        url,
      }) as { ok: boolean; error?: string };

      if (!result?.ok) {
        setSingleUrlError(result?.error ?? 'Failed to add source');
        return false;
      }
      return true;
    } catch {
      setSingleUrlError('Failed to reach the extension background.');
      return false;
    } finally {
      setIsAddingSingle(false);
    }
  }, [notebookId]);

  const reset = useCallback(() => {
    setJobId(null);
    setProgress(null);
    setIsImporting(false);
    setSingleUrl('');
    setSingleUrlError(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    jobId,
    progress,
    isImporting,
    singleUrl,
    setSingleUrl,
    singleUrlError,
    isAddingSingle,
    startBulkImport,
    cancelImport,
    addSingleUrl,
    reset,
  };
}
