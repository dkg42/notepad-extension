/**
 * @module useBulkActionsBar
 * @description Hook managing the mutually exclusive folder-picker and tag-input panels in the bulk actions toolbar. Parses comma-separated tag strings and delegates move/add-tags operations to the parent via callbacks.
 * @dependencies (none — React built-ins only)
 * @public useBulkActionsBar
 */
import { useState } from 'react';

export function useBulkActionsBar(
  onMoveToFolder: (folderId: string | undefined) => void,
  onAddTags: (tags: string[]) => void,
) {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const handleMoveToFolder = (folderId: string | undefined) => {
    onMoveToFolder(folderId);
    setShowFolderPicker(false);
  };

  const handleAddTags = (input: string) => {
    const tags = input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      onAddTags(tags);
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const toggleFolderPicker = () => {
    setShowFolderPicker((v) => !v);
    setShowTagInput(false);
  };

  const toggleTagInput = () => {
    setShowTagInput((v) => !v);
    setShowFolderPicker(false);
  };

  return {
    showFolderPicker,
    showTagInput,
    tagInput,
    setTagInput,
    handleMoveToFolder,
    handleAddTags,
    toggleFolderPicker,
    toggleTagInput,
  };
}
