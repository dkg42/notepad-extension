/**
 * @module useSnippetItem
 * @description Custom hook encapsulating clipboard copy, tag add/remove, and inline tag-input state for a single snippet item. Provides keyboard-driven tag commit (Enter/comma) and auto-focus behaviour for the tag input field.
 * @dependencies (none — React built-ins only)
 * @public useSnippetItem, parseHostname, MAX_PREVIEW_LENGTH
 */
import { useRef, useState } from 'react';

export const MAX_PREVIEW_LENGTH = 200;

export function parseHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function useSnippetItem(
  text: string,
  tags: string[],
  onUpdateTags: (tags: string[]) => void,
) {
  const [copied, setCopied] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleStartAddTag = () => {
    setIsAddingTag(true);
    setTimeout(() => tagInputRef.current?.focus(), 0);
  };

  const commitTag = () => {
    const raw = tagInput.trim().toLowerCase();
    if (raw && !tags.includes(raw)) {
      onUpdateTags([...tags, raw]);
    }
    setTagInput('');
    setIsAddingTag(false);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Escape') {
      setTagInput('');
      setIsAddingTag(false);
    }
  };

  const handleTagInputBlur = () => {
    commitTag();
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateTags(tags.filter((t) => t !== tag));
  };

  return {
    copied,
    handleCopy,
    isAddingTag,
    tagInput,
    setTagInput,
    tagInputRef,
    handleStartAddTag,
    handleTagInputKeyDown,
    handleTagInputBlur,
    handleRemoveTag,
  };
}
