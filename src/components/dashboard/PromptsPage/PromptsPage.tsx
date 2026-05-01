/**
 * @module PromptsPage
 * @description Full prompts management page that groups snippets by folder inside an accordion, with a search bar, animated tag filter menu, and bulk action support via nested PromptsTable.
 * @dependencies @/types, @/components/ui/accordion, @/components/dashboard/PromptsTable/PromptsTable, @/components/dashboard/SearchBar/SearchBar, @/utils/filter-snippets, @/utils/folder-utils
 * @public PromptsPage
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronRight, Folder as FolderIcon, Hash, Tag, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { getFolderPath } from '@/utils/folder-utils';
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
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tagMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setTagMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [tagMenuOpen]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [snippets]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filtered = useMemo(
    () => filterSnippets(snippets, searchQuery, new Set(), selectedTags, folders),
    [snippets, searchQuery, selectedTags, folders],
  );

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

        <div className="prompts-page__tag-filter" ref={tagMenuRef}>
          <button
            className={`prompts-page__tag-btn${tagMenuOpen ? ' prompts-page__tag-btn--open' : ''}${selectedTags.size > 0 ? ' prompts-page__tag-btn--active' : ''}`}
            onClick={() => setTagMenuOpen((v) => !v)}
            disabled={allTags.length === 0}
            title={allTags.length === 0 ? 'No tags yet' : 'Filter by tags'}
          >
            <Tag size={13} strokeWidth={1.75} />
            {selectedTags.size > 0
              ? `${selectedTags.size} tag${selectedTags.size > 1 ? 's' : ''}`
              : 'Tags'}
          </button>

          <AnimatePresence>
            {tagMenuOpen && (
              <motion.div
                className="prompts-page__tag-menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {selectedTags.size > 0 && (
                  <button
                    className="prompts-page__tag-clear"
                    onClick={() => setSelectedTags(new Set())}
                  >
                    Clear filter
                  </button>
                )}
                {allTags.map((tag) => {
                  const isSelected = selectedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      className="prompts-page__tag-item"
                      onClick={() => handleTagToggle(tag)}
                    >
                      <span className={`prompts-page__tag-check${isSelected ? ' prompts-page__tag-check--on' : ''}`}>
                        {isSelected && <Check size={11} strokeWidth={2.5} />}
                      </span>
                      #{tag}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
                  <span className="prompts-page__folder-name">{getFolderPath(folder.id, folders)}</span>
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
