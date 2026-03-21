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
