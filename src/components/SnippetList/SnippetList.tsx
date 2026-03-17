import React from 'react';
import type { Folder, Snippet } from '@/types';
import SnippetItem from '@/components/SnippetItem/SnippetItem';
import { buildFolderMap } from './useSnippetList';
import './SnippetList.css';

interface Props {
  snippets: Snippet[];
  folders: Folder[];
  onDelete: (id: string) => void;
}

export default function SnippetList({ snippets, folders, onDelete }: Props) {
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
        />
      ))}
    </ul>
  );
}