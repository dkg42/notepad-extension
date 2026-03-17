import React from 'react';
import type { Folder, Snippet } from '@/types';
import SnippetItem from './SnippetItem';

interface Props {
  snippets: Snippet[];
  folders: Folder[];
  onDelete: (id: string) => void;
}

export default function SnippetList({ snippets, folders, onDelete }: Props) {
  if (snippets.length === 0) {
    return (
      <p style={emptyStyle}>
        No prompts saved yet.
        <br />
        Use <strong>Save prompts</strong> on any LLM chatbot page.
      </p>
    );
  }

  const folderMap = new Map(folders.map((f) => [f.id, f.name]));

  return (
    <ul style={listStyle}>
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

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 400,
  overflowY: 'auto',
};

const emptyStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 13,
  textAlign: 'center',
  marginTop: 24,
  lineHeight: 1.6,
};