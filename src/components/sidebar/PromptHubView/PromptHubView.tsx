import React, { useMemo, useState } from 'react';
import {
  Search,
  X,
  Star,
  LayoutGrid,
  Folder,
  FolderOpen,
  ChevronDown,
  Plus,
  ArrowLeft,
  Pencil,
  Copy,
  Send,
  Check,
  SlidersHorizontal,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Snippet, Folder as FolderType } from '@/types';
import { getFolderTreeItems, getFolderPath } from '@/utils/folder-utils';
import { filterSnippets } from '@/utils/filter-snippets';
import { usePromptHubView } from './usePromptHubView';
import './PromptHubView.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TAG_COLORS = [
  { bg: 'var(--tag-1-bg)', fg: 'var(--tag-1-fg)' },
  { bg: 'var(--tag-2-bg)', fg: 'var(--tag-2-fg)' },
  { bg: 'var(--tag-3-bg)', fg: 'var(--tag-3-fg)' },
  { bg: 'var(--tag-4-bg)', fg: 'var(--tag-4-fg)' },
  { bg: 'var(--tag-5-bg)', fg: 'var(--tag-5-fg)' },
  { bg: 'var(--tag-6-bg)', fg: 'var(--tag-6-fg)' },
];

function tagColor(tag: string) {
  const idx = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

function getSnippetTitle(snippet: Snippet): string {
  if (snippet.title) return snippet.title;
  const text = snippet.text.trim();
  const firstLine = text.split('\n')[0];
  return firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
}

function formatAge(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return `${Math.floor(diff / 604_800_000)}w`;
}

function countDescendants(folderId: string, folders: FolderType[], snippets: Snippet[]): number {
  const ids = new Set<string>();
  const queue = [folderId];
  while (queue.length) {
    const id = queue.shift()!;
    ids.add(id);
    folders.filter((f) => f.parentId === id).forEach((f) => queue.push(f.id));
  }
  return snippets.filter((s) => s.folderId && ids.has(s.folderId)).length;
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({ tag, removable, onRemove }: { tag: string; removable?: boolean; onRemove?: () => void }) {
  const c = tagColor(tag);
  return (
    <span
      className="prompt-hub__tag"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="prompt-hub__tag-hash">#</span>{tag}
      {removable && (
        <button
          onClick={onRemove}
          style={{ marginLeft: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', opacity: 0.6, display: 'flex' }}
        >
          <X size={10} strokeWidth={2.2} />
        </button>
      )}
    </span>
  );
}

// ── Folder tree ────────────────────────────────────────────────────────────────

interface FolderTreeProps {
  folders: FolderType[];
  snippets: Snippet[];
  selectedFolder: string;
  onSelectFolder: (id: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
}

function FolderTree({
  folders,
  snippets,
  selectedFolder,
  onSelectFolder,
  expandedFolders,
  onToggleFolder,
}: FolderTreeProps) {
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);
  const totalCount = snippets.length;
  const starredCount = snippets.filter((s) => s.isFavorite).length;

  return (
    <div className="prompt-hub__folder-tree">
      <FolderRow
        id="__all"
        name="All prompts"
        depth={0}
        selected={selectedFolder === '__all'}
        onSelect={() => onSelectFolder('__all')}
        count={totalCount}
        icon={<LayoutGrid size={13} strokeWidth={1.8} />}
      />
      <FolderRow
        id="__starred"
        name="Favorites"
        depth={0}
        selected={selectedFolder === '__starred'}
        onSelect={() => onSelectFolder('__starred')}
        count={starredCount}
        icon={<Star size={13} strokeWidth={1.8} />}
      />

      {folders.length > 0 && (
        <>
          <div className="prompt-hub__folders-header">
            <span className="prompt-hub__folders-label">Folders</span>
            <button className="prompt-hub__folders-add" title="New folder">
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
          {treeItems.map(({ folder, depth }) => {
            const isOpen = expandedFolders.has(folder.id);
            const hasChildren = folders.some((f) => f.parentId === folder.id);
            const count = countDescendants(folder.id, folders, snippets);
            return (
              <FolderRow
                key={folder.id}
                id={folder.id}
                name={folder.name}
                depth={depth}
                selected={selectedFolder === folder.id}
                onSelect={() => onSelectFolder(folder.id)}
                count={count}
                icon={isOpen ? <FolderOpen size={13} strokeWidth={1.8} /> : <Folder size={13} strokeWidth={1.8} />}
                hasChildren={hasChildren}
                isOpen={isOpen}
                onToggle={() => onToggleFolder(folder.id)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

interface FolderRowProps {
  id: string;
  name: string;
  depth: number;
  selected: boolean;
  onSelect: () => void;
  count: number;
  icon: React.ReactNode;
  hasChildren?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

function FolderRow({ id, name, depth, selected, onSelect, count, icon, hasChildren, isOpen, onToggle }: FolderRowProps) {
  return (
    <div
      className={`prompt-hub__folder-row${selected ? ' prompt-hub__folder-row--selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={onSelect}
    >
      {hasChildren ? (
        <button
          className={`prompt-hub__folder-toggle${isOpen ? ' prompt-hub__folder-toggle--open' : ' prompt-hub__folder-toggle--closed'}`}
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
        >
          <ChevronDown size={11} strokeWidth={2} />
        </button>
      ) : (
        <span className="prompt-hub__folder-spacer" />
      )}
      <span className={`prompt-hub__folder-icon${selected ? ' prompt-hub__folder-icon--selected' : ''}`}>
        {icon}
      </span>
      <span className="prompt-hub__folder-name">{name}</span>
      {count > 0 && (
        <span className="prompt-hub__folder-count">{count}</span>
      )}
    </div>
  );
}

// ── Prompt card ────────────────────────────────────────────────────────────────

interface PromptCardProps {
  snippet: Snippet;
  onClick: () => void;
  onStar: (id: string) => void;
  searchQuery: string;
}

function PromptCard({ snippet, onClick, onStar, searchQuery }: PromptCardProps) {
  const title = getSnippetTitle(snippet);
  const tags = snippet.tags ?? [];

  return (
    <div className="prompt-hub__card" onClick={onClick}>
      <div className="prompt-hub__card-header">
        <div className="prompt-hub__card-content">
          <div className="prompt-hub__card-title">{highlightText(title, searchQuery)}</div>
          <div className="prompt-hub__card-body">{highlightText(snippet.text, searchQuery)}</div>
        </div>
        <button
          className={`prompt-hub__card-star${snippet.isFavorite ? ' prompt-hub__card-star--starred' : ' prompt-hub__card-star--unstarred'}`}
          onClick={(e) => { e.stopPropagation(); onStar(snippet.id); }}
          title={snippet.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={13}
            strokeWidth={1.8}
            fill={snippet.isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <div className="prompt-hub__card-footer">
        {tags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
        <span style={{ flex: 1 }} />
        <span className="prompt-hub__card-time">{formatAge(snippet.savedAt)}</span>
      </div>
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} style={{ background: 'var(--accent-soft)', color: 'var(--fg)', padding: '0 1px', borderRadius: 2 }}>
        {p}
      </mark>
    ) : p,
  );
}

// ── Prompt detail ──────────────────────────────────────────────────────────────

interface PromptDetailProps {
  snippet: Snippet;
  folders: FolderType[];
  editing: boolean;
  onClose: () => void;
  onStar: (id: string) => void;
  onStartEdit: () => void;
  onSave: (title: string, text: string) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
}

function PromptDetail({ snippet, folders, editing, onClose, onStar, onStartEdit, onSave, onDelete, onCopy }: PromptDetailProps) {
  const [editTitle, setEditTitle] = useState(getSnippetTitle(snippet));
  const [editBody, setEditBody] = useState(snippet.text);
  const [copied, setCopied] = useState(false);

  const breadcrumb = useMemo(() => {
    if (!snippet.folderId) return null;
    return getFolderPath(snippet.folderId, folders);
  }, [snippet.folderId, folders]);

  const handleCopy = () => {
    onCopy(snippet.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="prompt-hub__detail">
      <div className="prompt-hub__detail-bar">
        <button className="prompt-hub__icon-btn" title="Back" onClick={onClose}>
          <ArrowLeft size={14} />
        </button>
        {breadcrumb && (
          <div className="prompt-hub__detail-breadcrumb">{breadcrumb}</div>
        )}
        <button
          className="prompt-hub__icon-btn"
          title={snippet.isFavorite ? 'Unstar' : 'Star'}
          onClick={() => onStar(snippet.id)}
          style={{ color: snippet.isFavorite ? 'var(--accent)' : undefined }}
        >
          <Star size={14} strokeWidth={1.8} fill={snippet.isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button className="prompt-hub__icon-btn" title="More options">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div className="prompt-hub__detail-body">
        {editing ? (
          <input
            className="prompt-hub__detail-title-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h2 className="prompt-hub__detail-title">{getSnippetTitle(snippet)}</h2>
        )}

        <div className="prompt-hub__detail-tags">
          {(snippet.tags ?? []).map((t) => (
            <TagPill key={t} tag={t} removable={editing} />
          ))}
          {editing && (
            <button className="prompt-hub__detail-add-tag">
              <Plus size={10} strokeWidth={2.2} /> tag
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            className="prompt-hub__detail-textarea"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={12}
          />
        ) : (
          <div className="prompt-hub__detail-text">{snippet.text}</div>
        )}

        <div className="prompt-hub__detail-meta">
          <span>SAVED · {formatAge(snippet.savedAt)} ago</span>
        </div>
      </div>

      <div className="prompt-hub__detail-actions">
        {editing ? (
          <>
            <button className="prompt-hub__btn-ghost" onClick={onClose}>Cancel</button>
            <div className="prompt-hub__detail-actions-spacer" />
            <button className="prompt-hub__btn-primary" onClick={() => onSave(editTitle, editBody)}>
              <Check size={13} strokeWidth={2.2} /> Save
            </button>
          </>
        ) : (
          <>
            <button className="prompt-hub__btn-ghost" onClick={onStartEdit}>
              <Pencil size={13} /> Edit
            </button>
            <button className="prompt-hub__btn-ghost" onClick={handleCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <div className="prompt-hub__detail-actions-spacer" />
            <button
              className="prompt-hub__btn-ghost"
              style={{ color: 'oklch(0.55 0.18 25)' }}
              onClick={() => onDelete(snippet.id)}
              title="Delete prompt"
            >
              <Trash2 size={13} />
            </button>
            <button className="prompt-hub__btn-primary" disabled title="Send to active AI tab (coming soon)">
              <Send size={13} /> Send to chat
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compose card ───────────────────────────────────────────────────────────────

interface ComposeCardProps {
  open: boolean;
  onToggle: () => void;
  onCreate: (title: string, text: string, tags: string[]) => void;
}

function ComposeCard({ open, onToggle, onCreate }: ComposeCardProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = () => {
    if (!body.trim()) return;
    onCreate(title.trim(), body.trim(), tags);
    setTitle(''); setBody(''); setTags([]); setTagInput('');
  };

  const commitTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  if (!open) {
    return (
      <button className="prompt-hub__compose-fab" onClick={onToggle}>
        <div className="prompt-hub__compose-fab-icon">
          <Plus size={13} strokeWidth={2.4} />
        </div>
        New prompt
        <span className="prompt-hub__compose-fab-spacer" />
        <span className="prompt-hub__compose-fab-kbd">⌘N</span>
      </button>
    );
  }

  return (
    <div className="prompt-hub__compose-card">
      <div className="prompt-hub__compose-header">
        <span className="prompt-hub__compose-header-label">New prompt</span>
        <span className="prompt-hub__compose-header-spacer" />
        <button className="prompt-hub__compose-close" onClick={onToggle}>
          <X size={13} strokeWidth={2} />
        </button>
      </div>
      <div className="prompt-hub__compose-body">
        <input
          className="prompt-hub__compose-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Prompt title"
          autoFocus
        />
        <textarea
          className="prompt-hub__compose-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type or paste your prompt…"
          rows={4}
        />
        <div className="prompt-hub__compose-tags">
          {tags.map((t) => (
            <TagPill key={t} tag={t} removable onRemove={() => setTags(tags.filter((x) => x !== t))} />
          ))}
          <input
            className="prompt-hub__compose-tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault();
                commitTag();
              }
            }}
            placeholder="add tag…"
          />
        </div>
      </div>
      <div className="prompt-hub__compose-footer">
        <span className="prompt-hub__compose-char-count">{body.length} chars</span>
        <span className="prompt-hub__compose-footer-spacer" />
        <button className="prompt-hub__btn-ghost" onClick={onToggle}>Cancel</button>
        <button className="prompt-hub__btn-primary" onClick={handleSubmit}>
          <Check size={12} strokeWidth={2.4} /> Save
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PromptHubViewProps {
  snippets: Snippet[];
  folders: FolderType[];
  allTags: string[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleDelete: (id: string) => void;
  handleUpdateTags: (id: string, tags: string[]) => void;
  handleToggleFavorite: (id: string) => void;
  handleAddSnippet: (title: string, text: string, tags: string[], folderId?: string) => void;
}

export default function PromptHubView({
  snippets,
  folders,
  allTags,
  searchQuery,
  setSearchQuery,
  handleDelete,
  handleToggleFavorite,
  handleAddSnippet,
}: PromptHubViewProps) {
  const {
    selectedFolder,
    setSelectedFolder,
    expandedFolders,
    toggleFolder,
    openPromptId,
    openDetail,
    closeDetail,
    editingPrompt,
    setEditingPrompt,
    composeOpen,
    setComposeOpen,
    searchFocused,
    setSearchFocused,
    starredOnly,
    setStarredOnly,
    activeTags,
    toggleTag,
    setActiveTags,
  } = usePromptHubView();

  const openSnippet = openPromptId ? snippets.find((s) => s.id === openPromptId) : null;

  const visibleSnippets = useMemo(() => {
    let list = snippets;

    if (selectedFolder === '__starred') {
      list = list.filter((s) => s.isFavorite);
    } else if (selectedFolder !== '__all') {
      const ids = new Set<string>();
      const queue = [selectedFolder];
      while (queue.length) {
        const id = queue.shift()!;
        ids.add(id);
        folders.filter((f) => f.parentId === id).forEach((f) => queue.push(f.id));
      }
      list = list.filter((s) => s.folderId && ids.has(s.folderId));
    }

    if (starredOnly) list = list.filter((s) => s.isFavorite);
    if (activeTags.length) list = list.filter((s) => activeTags.every((t) => s.tags?.includes(t)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        (s.title ?? '').toLowerCase().includes(q) ||
        s.text.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [snippets, selectedFolder, folders, starredOnly, activeTags, searchQuery]);

  const listLabel = searchQuery
    ? 'Results'
    : selectedFolder === '__all'
    ? 'Recent'
    : selectedFolder === '__starred'
    ? 'Favorites'
    : (folders.find((f) => f.id === selectedFolder)?.name ?? 'Prompts');

  const handleSave = (title: string, text: string) => {
    if (!openSnippet) return;
    // Update snippet via updateTags doesn't cover title/text — use delete+add for now
    // In a full implementation, a storageService.updateSnippet method would be preferable
    handleDelete(openSnippet.id);
    handleAddSnippet(title, text, openSnippet.tags ?? [], openSnippet.folderId);
    closeDetail();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="prompt-hub">
      {openSnippet ? (
        <PromptDetail
          snippet={openSnippet}
          folders={folders}
          editing={editingPrompt}
          onClose={closeDetail}
          onStar={handleToggleFavorite}
          onStartEdit={() => setEditingPrompt(true)}
          onSave={handleSave}
          onDelete={(id) => { handleDelete(id); closeDetail(); }}
          onCopy={handleCopy}
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="prompt-hub__search-wrap">
            <div className={`prompt-hub__search-box${searchFocused ? ' prompt-hub__search-box--focused' : ''}`}>
              <Search size={14} color="var(--fg-3)" />
              <input
                className="prompt-hub__search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search prompts, folders, tags…"
              />
              {searchQuery ? (
                <button className="prompt-hub__search-clear" onClick={() => setSearchQuery('')}>
                  <X size={12} strokeWidth={2} />
                </button>
              ) : (
                <span className="prompt-hub__search-kbd">⌘K</span>
              )}
            </div>

            <div className="prompt-hub__filters">
              <button
                className={`prompt-hub__filter-pill${starredOnly ? ' prompt-hub__filter-pill--active' : ''}`}
                onClick={() => setStarredOnly(!starredOnly)}
              >
                <Star size={11} strokeWidth={1.8} fill={starredOnly ? 'currentColor' : 'none'} />
                Starred
              </button>

              {allTags.length > 0 && (
                <>
                  <div className="prompt-hub__filter-divider" />
                  <span className="prompt-hub__filter-label">tags</span>
                  {allTags.slice(0, 6).map((tag) => {
                    const active = activeTags.includes(tag);
                    const c = tagColor(tag);
                    return (
                      <button
                        key={tag}
                        className={`prompt-hub__tag-chip${active ? ' prompt-hub__tag-chip--active' : ''}`}
                        style={active ? { background: c.bg, color: c.fg } : {}}
                        onClick={() => toggleTag(tag)}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                  {activeTags.length > 0 && (
                    <button className="prompt-hub__filter-clear" onClick={() => setActiveTags([])}>
                      clear
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="prompt-hub__body">
            {snippets.length === 0 ? (
              <div className="prompt-hub__no-prompts">
                <div className="prompt-hub__no-prompts-icon">
                  <Sparkles size={26} strokeWidth={1.6} />
                </div>
                <h3 className="prompt-hub__no-prompts-title">Your prompt hub is empty</h3>
                <p className="prompt-hub__no-prompts-desc">
                  Save prompts you reuse — the ones you keep retyping into ChatGPT, Claude, or Gemini. Tag them, organize them, send them anywhere.
                </p>
                <button className="prompt-hub__no-prompts-btn" onClick={() => setComposeOpen(true)}>
                  <Plus size={13} strokeWidth={2.2} /> Save your first prompt
                </button>
              </div>
            ) : (
              <>
                <FolderTree
                  folders={folders}
                  snippets={snippets}
                  selectedFolder={selectedFolder}
                  onSelectFolder={setSelectedFolder}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                />

                <hr className="prompt-hub__divider" />

                <div className="prompt-hub__list-header">
                  <span className="prompt-hub__list-label">{listLabel}</span>
                  <span className="prompt-hub__list-count">· {visibleSnippets.length}</span>
                  <span className="prompt-hub__list-spacer" />
                  <button className="prompt-hub__list-sort-btn" title="Sort">
                    <SlidersHorizontal size={11} />
                  </button>
                </div>

                <div className="prompt-hub__cards">
                  {visibleSnippets.length === 0 ? (
                    <div className="prompt-hub__empty">No prompts match.</div>
                  ) : (
                    visibleSnippets.map((s) => (
                      <PromptCard
                        key={s.id}
                        snippet={s}
                        onClick={() => openDetail(s.id)}
                        onStar={handleToggleFavorite}
                        searchQuery={searchQuery}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <ComposeCard
            open={composeOpen}
            onToggle={() => setComposeOpen(!composeOpen)}
            onCreate={(title, text, tags) => {
              handleAddSnippet(title, text, tags);
              setComposeOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
