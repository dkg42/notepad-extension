import { useCallback, useRef, useState } from 'react';
import type { Snippet } from '@/types';

export function usePromptsTableRow(
  snippet: Snippet,
  onUpdateTags?: (id: string, tags: string[]) => void,
) {
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitInput = useCallback(() => {
    const raw = tagInputValue.trim();
    if (!raw) {
      setTagInputVisible(false);
      setTagInputValue('');
      return;
    }
    const currentTags = snippet.tags ?? [];
    const newTags = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !currentTags.includes(t));

    if (newTags.length > 0) {
      onUpdateTags?.(snippet.id, [...currentTags, ...newTags]);
    }
    setTagInputVisible(false);
    setTagInputValue('');
  }, [tagInputValue, snippet.id, snippet.tags, onUpdateTags]);

  const handleShowInput = useCallback(() => {
    setTagInputVisible(true);
    // Focus after next render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitInput();
      } else if (e.key === 'Escape') {
        setTagInputVisible(false);
        setTagInputValue('');
      }
    },
    [commitInput],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const updated = (snippet.tags ?? []).filter((t) => t !== tag);
      onUpdateTags?.(snippet.id, updated);
    },
    [snippet.id, snippet.tags, onUpdateTags],
  );

  return {
    tagInputVisible,
    tagInputValue,
    setTagInputValue,
    inputRef,
    handleShowInput,
    handleTagInputKeyDown,
    handleRemoveTag,
    handleTagInputBlur: commitInput,
  };
}
