import React from 'react';
import type { Snippet, TagMeta } from '@/types';
import TagCard from '@/components/dashboard/TagCard/TagCard';
import { useTagManager } from './useTagManager';
import './TagManager.css';

interface TagManagerProps {
  snippets: Snippet[];
  tagsMeta: TagMeta[];
  onRenameTag: (oldName: string, newName: string) => void;
  onDeleteTag: (name: string) => void;
  onTagColorChange: (name: string, color: string | undefined) => void;
}

export default function TagManager({
  snippets,
  tagsMeta,
  onRenameTag,
  onDeleteTag,
  onTagColorChange,
}: TagManagerProps) {
  const { enrichedTags, usageCounts } = useTagManager(snippets, tagsMeta);

  return (
    <div className="tag-manager">
      <div className="tag-manager__header">
        <h1 className="tag-manager__heading">Tags</h1>
        <p className="tag-manager__subheading">
          Manage tag colours, rename, or remove tags across all prompts.
        </p>
      </div>

      {enrichedTags.length === 0 ? (
        <div className="tag-manager__empty">
          <span className="tag-manager__empty-icon">◈</span>
          <p>No tags yet. Add tags to your saved prompts to see them here.</p>
        </div>
      ) : (
        <div className="tag-manager__grid">
          {enrichedTags.map((tag) => (
            <TagCard
              key={tag.name}
              tag={tag}
              usageCount={usageCounts.get(tag.name) ?? 0}
              onRename={onRenameTag}
              onDelete={onDeleteTag}
              onColorChange={onTagColorChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
