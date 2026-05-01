/**
 * @module TagManager
 * @description Page that renders a grid of TagCards for all tags across prompts and notebooks, supporting rename, delete, and colour-change actions.
 * @dependencies @/types, @/components/dashboard/TagCard/TagCard, ./useTagManager, @/contexts/SnippetsContext
 * @public TagManager
 */
import React from 'react';
import TagCard from '@/components/dashboard/TagCard/TagCard';
import { useTagManager } from './useTagManager';
import { useSnippets } from '@/contexts/SnippetsContext';
import './TagManager.css';

export default function TagManager() {
  const {
    snippets,
    tagsMeta,
    notebookAnnotations,
    handleRenameTag: onRenameTag,
    handleDeleteTag: onDeleteTag,
    handleTagColorChange: onTagColorChange,
  } = useSnippets();

  const { enrichedTags, usageCounts } = useTagManager(snippets, tagsMeta, notebookAnnotations);

  return (
    <div className="tag-manager">
      <div className="tag-manager__header">
        <h1 className="tag-manager__heading">Tags</h1>
        <p className="tag-manager__subheading">
          Manage tag colours, rename, or remove tags across all prompts and notebooks.
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
