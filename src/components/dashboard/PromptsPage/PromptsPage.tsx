import React, { useMemo, useState } from 'react';
import { ChevronRight, Folder as FolderIcon, Hash } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Folder, Snippet } from '@/types';
import { UNCATEGORIZED_ID } from '@/types';
import type { SortColumn } from '@/types/dashboard';
import PromptsTable from '@/components/dashboard/PromptsTable/PromptsTable';
import SearchBar from '@/components/dashboard/SearchBar/SearchBar';
import { filterSnippets } from '@/utils/filter-snippets';
import './PromptsPage.css';

interface PromptsPageProps {
  snippets: Snippet[];
  folders: Folder[];
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onToggleFavorite: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkMoveToFolder: (ids: string[], folderId: string | undefined) => Promise<void>;
  onBulkAddTags: (ids: string[], tags: string[]) => Promise<void>;
}

const HIDDEN_IN_FOLDER: SortColumn[] = ['folder'];

export default function PromptsPage({
  snippets,
  folders,
  onDelete,
  onUpdateTags,
  onToggleFavorite,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkAddTags,
}: PromptsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    const tagFilter = selectedTag ? new Set([selectedTag]) : new Set<string>();
    return filterSnippets(snippets, searchQuery, new Set(), tagFilter);
  }, [snippets, searchQuery, selectedTag]);

  // Group filtered snippets by folderId
  const groupedByFolder = useMemo(() => {
    const map = new Map<string, Snippet[]>();
    folders.forEach((f) => map.set(f.id, []));
    map.set(UNCATEGORIZED_ID, []);

    filtered.forEach((s) => {
      const key = s.folderId ?? UNCATEGORIZED_ID;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });

    return map;
  }, [filtered, folders]);

  const uncategorizedSnippets = groupedByFolder.get(UNCATEGORIZED_ID) ?? [];

  const sharedTableProps = {
    folders,
    onDelete,
    onUpdateTags,
    onToggleFavorite,
    onBulkDelete,
    onBulkMoveToFolder,
    onBulkAddTags,
    hideToolbar: true as const,
    className: 'prompts-page__inner-table',
    initialHiddenColumns: HIDDEN_IN_FOLDER,
  };

  return (
    <div className="prompts-page">
      <div className="prompts-page__header">
        <h1 className="prompts-page__title">Prompts</h1>
        <p className="prompts-page__subtitle">
          {snippets.length} prompt{snippets.length !== 1 ? 's' : ''} across{' '}
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="prompts-page__toolbar">
        <div className="prompts-page__toolbar-search">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search all prompts…"
          />
        </div>

        {allTags.length > 0 && (
          <select
            className="prompts-page__filter-select"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <span className="prompts-page__count">
          {filtered.length !== snippets.length
            ? `${filtered.length} of ${snippets.length} prompts`
            : `${snippets.length} prompt${snippets.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <Accordion type="multiple" className="prompts-page__accordion">
        {folders.map((folder) => {
          const folderSnippets = groupedByFolder.get(folder.id) ?? [];
          return (
            <AccordionItem key={folder.id} value={folder.id}>
              <AccordionTrigger>
                <div className="prompts-page__trigger-inner">
                  <span
                    className="prompts-page__folder-icon"
                    style={folder.color ? { color: folder.color } : undefined}
                  >
                    <FolderIcon size={16} strokeWidth={1.75} />
                  </span>
                  <span className="prompts-page__folder-name">{folder.name}</span>
                  <span className="prompts-page__folder-count">{folderSnippets.length}</span>
                </div>
                <ChevronRight size={14} className="accordion-trigger__chevron" />
              </AccordionTrigger>
              <AccordionContent>
                <PromptsTable snippets={folderSnippets} {...sharedTableProps} />
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Uncategorized section — always shown when no folders exist, or when it has items */}
        {(uncategorizedSnippets.length > 0 || folders.length === 0) && (
          <AccordionItem value={UNCATEGORIZED_ID}>
            <AccordionTrigger>
              <div className="prompts-page__trigger-inner">
                <span className="prompts-page__folder-icon prompts-page__folder-icon--muted">
                  <Hash size={16} strokeWidth={1.75} />
                </span>
                <span className="prompts-page__folder-name">Uncategorized</span>
                <span className="prompts-page__folder-count">{uncategorizedSnippets.length}</span>
              </div>
              <ChevronRight size={14} className="accordion-trigger__chevron" />
            </AccordionTrigger>
            <AccordionContent>
              <PromptsTable snippets={uncategorizedSnippets} {...sharedTableProps} />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
