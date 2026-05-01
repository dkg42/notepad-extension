/**
 * @module SnippetsContext
 * @description React context providing snippet, folder, and tag state with CRUD handlers.
 *   Consumed by PromptsPage, FolderExplorer, TagManager, AnalyticsPage, and DashboardHome.
 * @dependencies @/types, @/types/dashboard
 * @public SnippetsProvider, useSnippets
 */
import React, { createContext, useContext } from 'react';
import type { Folder, NotebookAnnotation, Snippet, TagMeta } from '@/types';

export interface SnippetsContextValue {
  snippets: Snippet[];
  folders: Folder[];
  tagsMeta: TagMeta[];
  notebookAnnotations: NotebookAnnotation[];
  favoritesCount: number;
  handleDelete: (id: string) => Promise<void>;
  handleUpdateTags: (id: string, tags: string[]) => Promise<void>;
  handleToggleFavorite: (id: string) => Promise<void>;
  handleBulkDelete: (ids: string[]) => Promise<void>;
  handleBulkMoveToFolder: (ids: string[], folderId: string | undefined) => Promise<void>;
  handleBulkAddTags: (ids: string[], tags: string[]) => Promise<void>;
  handleCreateFolder: (name: string, parentId?: string) => Promise<void>;
  handleRenameFolder: (id: string, name: string) => void;
  handleDeleteFolder: (id: string) => void;
  handleMoveFolder: (id: string, newParentId: string | undefined) => void;
  handleFolderColorChange: (id: string, color: string | undefined) => void;
  handleFolderReorder: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  handleViewFolderPrompts: (folderId: string) => void;
  handleRenameTag: (oldName: string, newName: string) => Promise<void>;
  handleDeleteTag: (name: string) => Promise<void>;
  handleTagColorChange: (name: string, color: string | undefined) => Promise<void>;
}

interface SnippetsProviderProps {
  /** Pre-memoised value object from the parent (e.g. DashboardApp). */
  value: SnippetsContextValue;
  children: React.ReactNode;
}

const SnippetsContext = createContext<SnippetsContextValue | null>(null);

/**
 * Provides snippet/folder/tag state to the subtree.
 * Callers are responsible for memoising `value` (useMemo) to avoid
 * unnecessary consumer re-renders.
 */
export function SnippetsProvider({ value, children }: SnippetsProviderProps) {
  return (
    <SnippetsContext.Provider value={value}>
      {children}
    </SnippetsContext.Provider>
  );
}

export function useSnippets(): SnippetsContextValue {
  const ctx = useContext(SnippetsContext);
  if (!ctx) {
    throw new Error('useSnippets must be used within a SnippetsProvider');
  }
  return ctx;
}
