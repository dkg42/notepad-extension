import React from 'react';
import type { Snippet } from '@/types';
import SnippetItem from './SnippetItem';

interface Props {
  snippets: Snippet[];
  onDelete: (id: string) => void;
}

export default function SnippetList({ snippets, onDelete }: Props) {
  if (snippets.length === 0) {
    return (
      <p style={emptyStyle}>
        No snippets saved yet.
        <br />
        Select text on any LLM chatbot page and click <strong>Save snippet</strong>.
      </p>
    );
  }

  return (
    <ul style={listStyle}>
      {snippets.map((snippet) => (
        <SnippetItem key={snippet.id} snippet={snippet} onDelete={onDelete} />
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
  maxHeight: 480,
  overflowY: 'auto',
};

const emptyStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 13,
  textAlign: 'center',
  marginTop: 24,
  lineHeight: 1.6,
};
