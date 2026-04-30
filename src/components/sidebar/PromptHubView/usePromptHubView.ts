import { useState } from 'react';

export type PromptHubFolder = '__all' | '__starred' | string;

export function usePromptHubView() {
  const [selectedFolder, setSelectedFolder] = useState<PromptHubFolder>('__all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
    expandedFolders,
    toggleFolder,
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
    renamingFolderId,
    setRenamingFolderId,
  };
}
