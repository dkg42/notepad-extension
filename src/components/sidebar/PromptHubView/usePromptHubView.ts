/**
 * @module usePromptHubView
 * @description Custom hook centralising all UI state for the Prompt Hub view: selected folder, open/editing prompt detail, compose panel, search focus, starred filter, active tag chips, and sort order. Folder create/rename/subfolder UX is owned by FolderNav.
 * @dependencies (none — React built-ins only)
 * @public usePromptHubView, PromptHubFolder, SortOrder
 */
import { useState } from 'react';

export type PromptHubFolder = '__all' | '__starred' | string;
export type SortOrder = 'newest' | 'oldest' | 'az' | 'za';

export function usePromptHubView() {
  const [selectedFolder, setSelectedFolder] = useState<PromptHubFolder>('__all');
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [sortOpen, setSortOpen] = useState(false);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const openDetail = (id: string) => {
    setOpenPromptId(id);
    setEditingPrompt(false);
  };

  const closeDetail = () => {
    setOpenPromptId(null);
    setEditingPrompt(false);
  };

  return {
    selectedFolder,
    setSelectedFolder,
    openPromptId,
    openDetail,
    closeDetail,
    editingPrompt,
    setEditingPrompt,
    composeOpen,
    setComposeOpen,
    searchFocused,
    setSearchFocused,
    starredOnly,
    setStarredOnly,
    activeTags,
    toggleTag,
    setActiveTags,
    sortOrder,
    setSortOrder,
    sortOpen,
    setSortOpen,
  };
}
