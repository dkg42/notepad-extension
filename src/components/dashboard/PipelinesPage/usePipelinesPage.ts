import { useCallback, useEffect, useState } from 'react';
import type { NotebookCollection, Pipeline, PipelineRun } from '@/types';
import { PIPELINE_TEMPLATES } from '@/services/pipeline-templates';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';

export function usePipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [collections, setCollections] = useState<NotebookCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [pipelinesRes, runsRes, loadedCollections] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_PIPELINES' }) as Promise<{
          ok: boolean; pipelines?: Pipeline[]; error?: string;
        }>,
        chrome.runtime.sendMessage({ type: 'GET_PIPELINE_RUNS' }) as Promise<{
          ok: boolean; runs?: PipelineRun[]; error?: string;
        }>,
        notebookAnnotationService.getAllCollections(),
      ]);

      if (pipelinesRes.ok) setPipelines(pipelinesRes.pipelines ?? []);
      else setError(pipelinesRes.error ?? 'Failed to load pipelines');

      if (runsRes.ok) setRuns(runsRes.runs ?? []);

      setCollections(loadedCollections);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Keep pipeline list reactive to background changes (e.g. after a run fires)
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('pipelines' in changes) {
        setPipelines((changes.pipelines.newValue as Pipeline[]) ?? []);
      }
      if ('pipelineRuns' in changes) {
        setRuns((changes.pipelineRuns.newValue as PipelineRun[]) ?? []);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (id: string) => {
    const res = await chrome.runtime.sendMessage({ type: 'TOGGLE_PIPELINE', id }) as {
      ok: boolean; error?: string;
    };
    if (!res.ok) setError(res.error ?? 'Failed to toggle pipeline');
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await chrome.runtime.sendMessage({ type: 'DELETE_PIPELINE', id }) as {
      ok: boolean; error?: string;
    };
    if (!res.ok) setError(res.error ?? 'Failed to delete pipeline');
  }, []);

  const handleSave = useCallback(async (pipeline: Pipeline) => {
    const res = await chrome.runtime.sendMessage({ type: 'SAVE_PIPELINE', pipeline }) as {
      ok: boolean; error?: string;
    };
    if (res.ok) {
      setIsBuilderOpen(false);
      setSelectedPipeline(null);
    } else {
      setError(res.error ?? 'Failed to save pipeline');
    }
  }, []);

  const handleRunNow = useCallback(async (pipeline: Pipeline) => {
    setRunningId(pipeline.id);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'RUN_PIPELINE_NOW', pipeline }) as {
        ok: boolean; runs?: PipelineRun[]; error?: string;
      };
      if (!res.ok) setError(res.error ?? 'Pipeline run failed');
    } finally {
      setRunningId(null);
    }
  }, []);

  const handleInstallTemplate = useCallback(async (template: Pipeline) => {
    const installed: Pipeline = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isTemplate: false,
    };
    // Open builder so user can fill in placeholder values before saving
    setSelectedPipeline(installed);
    setIsBuilderOpen(true);
  }, []);

  const handleClearRuns = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_PIPELINE_RUNS' });
  }, []);

  const openBuilder = useCallback((pipeline?: Pipeline) => {
    setSelectedPipeline(pipeline ?? null);
    setIsBuilderOpen(true);
  }, []);

  const closeBuilder = useCallback(() => {
    setIsBuilderOpen(false);
    setSelectedPipeline(null);
  }, []);

  return {
    pipelines,
    runs: runs.slice(0, 20), // Show last 20 runs
    collections,
    templates: PIPELINE_TEMPLATES,
    isLoading,
    error,
    runningId,
    selectedPipeline,
    isBuilderOpen,
    handleToggle,
    handleDelete,
    handleSave,
    handleRunNow,
    handleInstallTemplate,
    handleClearRuns,
    openBuilder,
    closeBuilder,
  };
}
