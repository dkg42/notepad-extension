/**
 * @module useNotebookDetailPage
 * @description Hook for the notebook detail page that loads sources, notes, and artifacts via a single RPC call, and provides handlers for brief generation, audio overview creation, source add/delete, notebook delete, tag management, collection assignment, and source export.
 * @dependencies @/types, @/services/notebook-sync-service, @/services/notebook-annotation-service, @/export/source-export-registry, @/services/notebooklm-api
 * @public useNotebookDetailPage
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtifactRecord, Folder, NoteDetailRecord, NotebookAnnotation, NotebookMeta, SourceDetailRecord } from '@/types';
import type { AudioOverviewOptions } from '@/services/notebooklm-api';
import { notebookSyncService } from '@/services/notebook-sync-service';
import { notebookAnnotationService } from '@/services/notebook-annotation-service';
import { notebookFolderService } from '@/services/notebook-folder-service';
import { sourceExportStrategies } from '@/export/source-export-registry';

interface MessageResult<T = unknown> {
  ok: boolean;
  error?: string;
  summary?: string;
  sources?: T[];
  notes?: T[];
  artifacts?: T[];
}

export function useNotebookDetailPage(notebookId: string, onBack: () => void) {
  // ── Notebook meta ──────────────────────────────────────────────────────────
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  // ── Sources ────────────────────────────────────────────────────────────────
  const [sources, setSources] = useState<SourceDetailRecord[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  // ── Notes ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<NoteDetailRecord[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  // ── Artifacts ──────────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);

  // ── Brief ──────────────────────────────────────────────────────────────────
  const [brief, setBrief] = useState<string | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // ── Audio ──────────────────────────────────────────────────────────────────
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioGenerationError, setAudioGenerationError] = useState<string | null>(null);

  // ── Source import ──────────────────────────────────────────────────────────
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [isDeletingSource, setIsDeletingSource] = useState<string | null>(null);

  // ── Annotation & folders ───────────────────────────────────────────────────
  const [annotation, setAnnotation] = useState<NotebookAnnotation>({ notebookId, tags: [] });
  const [folders, setFolders] = useState<Folder[]>([]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  // ── Initial load ───────────────────────────────────────────────────────────

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Load notebook meta + annotation + folders from storage (instant)
    Promise.all([
      notebookSyncService.getAll(),
      notebookAnnotationService.getAllAnnotations(),
      notebookFolderService.getFolders(),
    ]).then(([all, allAnnotations, allFolders]) => {
      setNotebook(all.find((n) => n.id === notebookId) ?? null);
      setAnnotation(allAnnotations.find((a) => a.notebookId === notebookId) ?? { notebookId, tags: [] });
      setFolders(allFolders);
      setIsLoadingMeta(false);
    });

    // Single RPC call fetches sources, notes, and artifacts from GET_NOTEBOOK response
    chrome.runtime
      .sendMessage({ type: 'FETCH_NOTEBOOK_FULL_DATA', notebookId })
      .then((result: MessageResult & { sources?: SourceDetailRecord[]; notes?: NoteDetailRecord[]; artifacts?: ArtifactRecord[] } | undefined) => {
        if (result?.ok) {
          if (result.sources) setSources(result.sources);
          if (result.notes) setNotes(result.notes);
          if (result.artifacts) setArtifacts(result.artifacts);
        } else if (result && !result.ok) {
          const err = result.error ?? 'Failed to fetch notebook data';
          setSourcesError(err);
          setNotesError(err);
          setArtifactsError(err);
        }
      })
      .catch(() => {
        const err = 'Failed to reach the extension background.';
        setSourcesError(err);
        setNotesError(err);
        setArtifactsError(err);
      })
      .finally(() => {
        setIsLoadingSources(false);
        setIsLoadingNotes(false);
        setIsLoadingArtifacts(false);
      });
  }, [notebookId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerateBrief = useCallback(async () => {
    setIsGeneratingBrief(true);
    setBriefError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SUMMARIZE_NOTEBOOK',
        notebookId,
      }) as MessageResult;
      if (result?.ok && result.summary) {
        setBrief(result.summary);
      } else {
        setBriefError(result?.error ?? 'Failed to generate brief');
      }
    } catch {
      setBriefError('Failed to reach the extension background.');
    } finally {
      setIsGeneratingBrief(false);
    }
  }, [notebookId]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    setIsDeletingSource(sourceId);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'DELETE_SOURCE',
        sourceId,
      }) as MessageResult;
      if (result?.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
      } else {
        setSourcesError(result?.error ?? 'Failed to delete source');
      }
    } catch {
      setSourcesError('Failed to reach the extension background.');
    } finally {
      setIsDeletingSource(null);
    }
  }, []);

  const handleAddSourceUrl = useCallback(async (url: string) => {
    setIsAddingSource(true);
    setAddSourceError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'ADD_SOURCE_URL',
        notebookId,
        url,
      }) as MessageResult;
      if (!result?.ok) {
        setAddSourceError(result?.error ?? 'Failed to add source');
        return false;
      }
      // Re-fetch all notebook data to get the updated source list
      const refreshResult = await chrome.runtime.sendMessage({
        type: 'FETCH_NOTEBOOK_FULL_DATA',
        notebookId,
      }) as MessageResult & { sources?: SourceDetailRecord[] };
      if (refreshResult?.ok && refreshResult.sources) {
        setSources(refreshResult.sources);
      }
      return true;
    } catch {
      setAddSourceError('Failed to reach the extension background.');
      return false;
    } finally {
      setIsAddingSource(false);
    }
  }, [notebookId]);

  const handleGenerateAudio = useCallback(async (options?: AudioOverviewOptions) => {
    setIsGeneratingAudio(true);
    setAudioGenerationError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_AUDIO_OVERVIEW',
        notebookId,
        options,
      }) as MessageResult;
      if (!result?.ok) {
        setAudioGenerationError(result?.error ?? 'Failed to generate audio');
        return;
      }
      // Re-fetch all data after a short delay (audio generation is async on server)
      setTimeout(async () => {
        try {
          const refreshResult = await chrome.runtime.sendMessage({
            type: 'FETCH_NOTEBOOK_FULL_DATA',
            notebookId,
          }) as MessageResult & { sources?: SourceDetailRecord[]; notes?: NoteDetailRecord[]; artifacts?: ArtifactRecord[] };
          if (refreshResult?.ok) {
            if (refreshResult.artifacts) setArtifacts(refreshResult.artifacts);
          }
        } catch {
          // Silent — user can manually refresh
        } finally {
          setIsGeneratingAudio(false);
        }
      }, 3000);
    } catch {
      setAudioGenerationError('Failed to reach the extension background.');
      setIsGeneratingAudio(false);
    }
  }, [notebookId]);

  const handleDeleteNotebook = useCallback(async () => {
    setIsDeletingNotebook(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'DELETE_NOTEBOOK',
        notebookId,
      }) as MessageResult;
      if (result?.ok) {
        await notebookAnnotationService.removeAnnotation(notebookId);
        onBack();
      } else {
        setIsDeletingNotebook(false);
      }
    } catch {
      setIsDeletingNotebook(false);
    }
  }, [notebookId, onBack]);

  const handleAssignFolder = useCallback(
    async (folderId: string | undefined) => {
      const updated = { ...annotation, folderId };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotation(updated);
    },
    [annotation],
  );

  const handleCreateFolder = useCallback(
    async (name: string, parentId?: string): Promise<string> => {
      const folder = await notebookFolderService.createFolder(name.trim(), parentId);
      setFolders((prev) => [...prev, folder]);
      return folder.id;
    },
    [],
  );

  const handleAddTag = useCallback(
    async (tag: string) => {
      if (!tag || annotation.tags.includes(tag)) return;
      const updated = { ...annotation, tags: [...annotation.tags, tag] };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotation(updated);
    },
    [annotation],
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      const updated = { ...annotation, tags: annotation.tags.filter((t) => t !== tag) };
      await notebookAnnotationService.setAnnotation(updated);
      setAnnotation(updated);
    },
    [annotation],
  );

  const handleExportSources = useCallback(async (strategyType: string) => {
    if (!notebook) return;
    setIsExporting(true);
    try {
      const strategy = sourceExportStrategies.find((s) => s.type === strategyType);
      if (strategy) {
        const filename = `${notebook.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}-sources`;
        await strategy.export(sources, filename);
      }
    } catch {
      setSourcesError('Export failed. Try again.');
    } finally {
      setIsExporting(false);
    }
  }, [notebook, sources]);

  /** Refreshes all notebook data (sources, notes, artifacts) via the single GET_NOTEBOOK RPC. */
  const handleRefreshAll = useCallback(async () => {
    setIsLoadingSources(true);
    setIsLoadingNotes(true);
    setIsLoadingArtifacts(true);
    setSourcesError(null);
    setNotesError(null);
    setArtifactsError(null);
    // Clear cached audio so stale entries are re-fetched on next play
    void chrome.runtime.sendMessage({ type: 'CLEAR_AUDIO_CACHE' });
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'FETCH_NOTEBOOK_FULL_DATA',
        notebookId,
      }) as MessageResult & { sources?: SourceDetailRecord[]; notes?: NoteDetailRecord[]; artifacts?: ArtifactRecord[] };
      if (result?.ok) {
        if (result.sources) setSources(result.sources);
        if (result.notes) setNotes(result.notes);
        if (result.artifacts) setArtifacts(result.artifacts);
      } else {
        const err = result?.error ?? 'Failed to refresh notebook data.';
        setSourcesError(err);
        setNotesError(err);
        setArtifactsError(err);
      }
    } catch {
      const err = 'Failed to reach the extension background.';
      setSourcesError(err);
      setNotesError(err);
      setArtifactsError(err);
    } finally {
      setIsLoadingSources(false);
      setIsLoadingNotes(false);
      setIsLoadingArtifacts(false);
    }
  }, [notebookId]);

  return {
    notebook,
    annotation,
    folders,
    isLoadingMeta,
    sources,
    isLoadingSources,
    sourcesError,
    setSourcesError,
    notes,
    isLoadingNotes,
    notesError,
    artifacts,
    isLoadingArtifacts,
    artifactsError,
    brief,
    isGeneratingBrief,
    briefError,
    isGeneratingAudio,
    audioGenerationError,
    isAddingSource,
    addSourceError,
    setAddSourceError,
    isDeletingNotebook,
    isDeletingSource,
    isExporting,
    handleAssignFolder,
    handleCreateFolder,
    handleAddTag,
    handleRemoveTag,
    handleGenerateBrief,
    handleDeleteSource,
    handleAddSourceUrl,
    handleGenerateAudio,
    handleDeleteNotebook,
    handleExportSources,
    handleRefreshAll,
  };
}
