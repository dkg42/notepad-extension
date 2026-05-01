/**
 * @module SnippetList
 * @description Renders an ordered list of saved prompt snippets, grouped by folder. Displays an empty-state message when no snippets exist and delegates per-item rendering to SnippetItem.
 * @dependencies @/types, @/components/SnippetItem/SnippetItem, ./useSnippetList
 * @public SnippetList (default export)
 */
import React from 'react';
import type { Folder, Snippet } from '@/types';
import SnippetItem from '@/components/SnippetItem/SnippetItem';
import { buildFolderMap } from './useSnippetList';
import './SnippetList.css';

interface Props {
  snippets: Snippet[];
  folders: Folder[];
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
}

export default function SnippetList({ snippets, folders, onDelete, onUpdateTags }: Props) {
  if (snippets.length === 0) {
    return (
      <p className="snippet-list__empty">
        No prompts saved yet.
        <br />
        Use <strong>Save prompts</strong> on any LLM chatbot page.
      </p>
    );
  }

  const folderMap = buildFolderMap(folders);

  return (
    <ul className="snippet-list">
      {snippets.map((snippet) => (
        <SnippetItem
          key={snippet.id}
          snippet={snippet}
          folderName={snippet.folderId ? folderMap.get(snippet.folderId) : undefined}
          onDelete={onDelete}
          onUpdateTags={onUpdateTags}
        />
      ))}
    </ul>
  );
}