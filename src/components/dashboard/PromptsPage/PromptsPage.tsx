/**
 * @module PromptsPage
 * @description Prompt Hub dashboard page — nested folder tree panel on the left, sortable/filterable prompt table on the right. Handles both the "Prompts" and "Favorites" views via the `initialFolder` prop.
 * @dependencies @/types, @/contexts/SnippetsContext, @/utils/folder-utils
 * @public PromptsPage
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search, X, Star, LayoutGrid, Folder, ChevronDown, Plus,
  ChevronUp, Check, Trash2, Copy, Pencil,
  MoreHorizontal, ArrowLeft, ArrowUpDown, Sparkles,
} from 'lucide-react';
import type { Snippet, Folder as FolderType } from '@/types';
import { getFolderTreeItems, getFolderSubtreeIds, getFolderPath } from '@/utils/folder-utils';
import { useSnippets } from '@/contexts/SnippetsContext';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { aiService } from '@/services/ai-service';
import FolderNav from '@/components/dashboard/FolderNav/FolderNav';
import './PromptsPage.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

type Platform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'copilot' | 'other';

const PLATFORM_COLORS: Record<Platform, { bg: string; fg: string; dot: string; label: string }> = {
  chatgpt:    { bg: 'oklch(0.27 0.06 152)', fg: 'oklch(0.86 0.12 152)', dot: 'oklch(0.62 0.18 152)', label: 'ChatGPT'    },
  claude:     { bg: 'oklch(0.27 0.06 55)',  fg: 'oklch(0.88 0.12 55)',  dot: 'oklch(0.70 0.16 55)',  label: 'Claude'      },
  gemini:     { bg: 'oklch(0.27 0.06 270)', fg: 'oklch(0.85 0.12 270)', dot: 'oklch(0.65 0.16 270)', label: 'Gemini'      },
  perplexity: { bg: 'oklch(0.27 0.06 220)', fg: 'oklch(0.85 0.12 220)', dot: 'oklch(0.62 0.14 220)', label: 'Perplexity'  },
  copilot:    { bg: 'oklch(0.27 0.05 240)', fg: 'oklch(0.85 0.10 240)', dot: 'oklch(0.58 0.14 240)', label: 'Copilot'     },
  other:      { bg: 'var(--bg-3)',          fg: 'var(--fg-2)',           dot: 'var(--fg-3)',          label: 'Other'       },
};

function getPlatform(source: string): Platform {
  if (!source) return 'other';
  const s = source.toLowerCase();
  if (s.includes('chatgpt.com') || s.includes('chat.openai.com')) return 'chatgpt';
  if (s.includes('claude.ai')) return 'claude';
  if (s.includes('gemini.google.com')) return 'gemini';
  if (s.includes('perplexity.ai')) return 'perplexity';
  if (s.includes('copilot.microsoft.com')) return 'copilot';
  return 'other';
}

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

function getSnippetTitle(s: Snippet): string {
  const t = s.title?.trim();
  if (t) return t;
  const first = s.text.trim().split('\n')[0];
  return first.length > 80 ? first.slice(0, 80) + '…' : first;
}

function countDescendants(folderId: string, folders: FolderType[], snippets: Snippet[]): number {
  const ids = getFolderSubtreeIds(folderId, folders);
  return snippets.filter((s) => s.folderId && ids.has(s.folderId)).length;
}

type SortCol = 'savedAt' | 'title' | 'usageCount';

// ── Tag chip ───────────────────────────────────────────────────────────────────

function TagChip({ tag, removable, onRemove }: { tag: string; removable?: boolean; onRemove?: () => void }) {
  const c = tagColor(tag);
  return (
    <span className="ph-tag" style={{ background: c.bg, color: c.fg }}>
      <span className="ph-tag__hash">#</span>{tag}
      {removable && (
        <button className="ph-tag__remove" onClick={onRemove}>
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const platform = getPlatform(source);
  const c = PLATFORM_COLORS[platform];
  return (
    <span className="ph-source" style={{ background: c.bg, color: c.fg }}>
      <span className="ph-source__dot" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

// ── Folder panel virtual rows ─────────────────────────────────────────────────

function VirtualFolderRow({ selected, onClick, icon, label, count }: { selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <div
      className={`ph-folder-row${selected ? ' ph-folder-row--selected' : ''}`}
      style={{ paddingLeft: 8 }}
      onClick={onClick}
    >
      <span className="ph-folder-row__spacer" />
      <span className={`ph-folder-row__icon${selected ? ' ph-folder-row__icon--selected' : ''}`}>{icon}</span>
      <span className="ph-folder-row__name">{label}</span>
      {count > 0 && <span className="ph-folder-row__count">{count}</span>}
    </div>
  );
}

// ── Row overflow menu ──────────────────────────────────────────────────────────

interface RowMenuProps {
  snippet: Snippet;
  folders: FolderType[];
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: (folderId: string | undefined) => void;
  onDelete: () => void;
  onClose: () => void;
}

function RowMenu({ snippet, folders, onEdit, onDuplicate, onMove, onDelete, onClose }: RowMenuProps) {
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);
  return (
    <>
      <div className="ph-row-menu__backdrop" onClick={onClose} />
      <div className="ph-row-menu">
        <button className="ph-row-menu__item" onClick={() => { onClose(); onEdit(); }}>
          <Pencil size={12} /> Edit
        </button>
        <button className="ph-row-menu__item" onClick={() => { onClose(); onDuplicate(); }}>
          <Copy size={12} /> Duplicate
        </button>
        {folders.length > 0 && (
          <>
            <div className="ph-row-menu__divider" />
            <div className="ph-row-menu__label">Move to folder</div>
            <button
              className={`ph-row-menu__folder${!snippet.folderId ? ' ph-row-menu__folder--cur' : ''}`}
              onClick={() => { onClose(); onMove(undefined); }}
            >
              No folder
            </button>
            {treeItems.map(({ folder, depth }) => (
              <button
                key={folder.id}
                className={`ph-row-menu__folder${snippet.folderId === folder.id ? ' ph-row-menu__folder--cur' : ''}`}
                style={{ paddingLeft: 10 + depth * 12 }}
                onClick={() => { onClose(); onMove(folder.id); }}
              >
                <Folder size={10} /> {folder.name}
              </button>
            ))}
          </>
        )}
        <div className="ph-row-menu__divider" />
        <button className="ph-row-menu__item ph-row-menu__item--danger" onClick={() => { onClose(); onDelete(); }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </>
  );
}

// ── Prompt detail panel ────────────────────────────────────────────────────────

interface DetailPanelProps {
  snippet: Snippet;
  folders: FolderType[];
  onBack: () => void;
  onStar: (id: string) => void;
  onSave: (id: string, title: string, text: string) => void;
  onDelete: (id: string) => void;
}

function DetailPanel({ snippet, folders, onBack, onStar, onSave, onDelete }: DetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(getSnippetTitle(snippet));
  const [editBody, setEditBody] = useState(snippet.text);
  const [copied, setCopied] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedText, setEnhancedText] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const breadcrumb = snippet.folderId ? getFolderPath(snippet.folderId, folders) : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setEnhanceError(null);
    setEnhancedText(null);
    try {
      const result = await aiService.enhancePrompt(snippet.text);
      setEnhancedText(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AI_UNSUPPORTED') setEnhanceError('Chrome AI is not available in this browser.');
      else if (msg === 'AI_AFTER-DOWNLOAD') setEnhanceError('AI model is downloading. Try again shortly.');
      else if (msg === 'AI_UNAVAILABLE') setEnhanceError('AI model unavailable. Check chrome://flags/#optimization-guide-on-device-model.');
      else setEnhanceError(`Enhancement failed: ${msg}`);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="ph-detail">
      <div className="ph-detail__bar">
        <button className="ph-icon-btn" onClick={onBack} title="Back"><ArrowLeft size={14} /></button>
        {breadcrumb && <span className="ph-detail__breadcrumb">{breadcrumb}</span>}
        <span className="ph-detail__spacer" />
        <button
          className={`ph-icon-btn${enhancing ? ' ph-icon-btn--active' : ''}`}
          title={enhancing ? 'Enhancing…' : 'Enhance with AI'}
          disabled={enhancing || editing}
          onClick={handleEnhance}
        >
          {enhancing ? <span className="ph-spinner" /> : <Sparkles size={14} />}
        </button>
        <button className="ph-icon-btn" title={snippet.isFavorite ? 'Unstar' : 'Star'} onClick={() => onStar(snippet.id)} style={{ color: snippet.isFavorite ? 'var(--accent)' : undefined }}>
          <Star size={14} strokeWidth={1.8} fill={snippet.isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="ph-detail__body">
        {editing ? (
          <input className="ph-detail__title-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
        ) : (
          <h2 className="ph-detail__title">{getSnippetTitle(snippet)}</h2>
        )}

        <div className="ph-detail__tags">
          {(snippet.tags ?? []).map((t) => <TagChip key={t} tag={t} />)}
        </div>

        {editing ? (
          <textarea className="ph-detail__textarea" value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={14} />
        ) : (
          <div className="ph-detail__text">{snippet.text}</div>
        )}

        <div className="ph-detail__meta">
          <SourceBadge source={snippet.source} />
          <span className="ph-detail__saved">Saved {new Date(snippet.savedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {enhancedText && (
        <div className="ph-enhance-preview">
          <div className="ph-enhance-preview-label">
            <Sparkles size={11} /> Enhanced version
          </div>
          <div className="ph-enhance-preview-text">{enhancedText}</div>
          <div className="ph-enhance-preview-actions">
            <button className="ph-btn-ghost" onClick={() => setEnhancedText(null)}>Discard</button>
            <button
              className="ph-btn-primary"
              onClick={() => { onSave(snippet.id, getSnippetTitle(snippet), enhancedText); setEnhancedText(null); }}
            >
              <Check size={13} /> Apply
            </button>
          </div>
        </div>
      )}

      {enhanceError && (
        <div className="ph-enhance-error">{enhanceError}</div>
      )}

      <div className="ph-detail__actions">
        {editing ? (
          <>
            <button className="ph-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <span className="ph-detail__spacer" />
            <button className="ph-btn-primary" onClick={() => { onSave(snippet.id, editTitle, editBody); setEditing(false); }}>
              <Check size={13} strokeWidth={2.2} /> Save
            </button>
          </>
        ) : (
          <>
            <button className="ph-btn-ghost" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
            <button className="ph-btn-ghost" onClick={handleCopy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy'}</button>
            <span className="ph-detail__spacer" />
            <button className="ph-btn-ghost ph-btn-ghost--danger" onClick={() => onDelete(snippet.id)}><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compose modal ──────────────────────────────────────────────────────────────

interface ComposeModalProps {
  folders: FolderType[];
  defaultFolderId?: string;
  onCreate: (title: string, text: string, tags: string[], folderId?: string) => void;
  onClose: () => void;
}

function ComposeModal({ folders, defaultFolderId, onCreate, onClose }: ComposeModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const commitTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const handleSubmit = () => {
    if (!body.trim()) return;
    const finalTags = tagInput.trim() ? [...tags, tagInput.trim().toLowerCase()] : tags;
    onCreate(title.trim(), body.trim(), finalTags, defaultFolderId || undefined);
    onClose();
  };

  return (
    <div className="ph-modal-overlay" onClick={onClose}>
      <div className="ph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ph-modal__header">
          <span className="ph-modal__title">New prompt</span>
          <button className="ph-icon-btn" onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>

        <div className="ph-modal__body">
          <input className="ph-modal__title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prompt title (optional)" autoFocus />
          <textarea className="ph-modal__textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type or paste your prompt…" rows={6} />

          <div className="ph-modal__field-label">Tags</div>
          <div className="ph-modal__tags">
            {tags.map((t) => <TagChip key={t} tag={t} removable onRemove={() => setTags(tags.filter((x) => x !== t))} />)}
            <input
              className="ph-modal__tag-input" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); commitTag(); } }}
              placeholder="add tag…"
            />
          </div>

          {defaultFolderId && (
            <div className="ph-modal__folder-badge">
              {getFolderPath(defaultFolderId, folders)}
            </div>
          )}
        </div>

        <div className="ph-modal__footer">
          <span className="ph-modal__char-count">{body.length} chars</span>
          <span className="ph-detail__spacer" />
          <button className="ph-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ph-btn-primary" onClick={handleSubmit} disabled={!body.trim()}>
            <Check size={12} strokeWidth={2.4} /> Save prompt
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort header cell ───────────────────────────────────────────────────────────

function SortHeader({ col, label, current, dir, onSort }: { col: SortCol; label: string; current: SortCol; dir: 'asc' | 'desc'; onSort: (c: SortCol) => void }) {
  const active = current === col;
  return (
    <th className={`ph-th${active ? ' ph-th--active' : ''}`} onClick={() => onSort(col)}>
      {label}
      {active ? (dir === 'asc' ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />) : <ArrowUpDown size={11} strokeWidth={1.8} style={{ opacity: 0.35 }} />}
    </th>
  );
}

// ── Bulk actions bar ───────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number;
  folders: FolderType[];
  onDelete: () => void;
  onMove: (folderId: string | undefined) => void;
  onAddTags: (tags: string[]) => void;
  onClear: () => void;
}

function BulkBar({ count, folders, onDelete, onMove, onClear }: BulkBarProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);

  return (
    <div className="ph-bulk-bar">
      <span className="ph-bulk-bar__count">{count} selected</span>
      <button className="ph-bulk-btn" onClick={onClear}>Deselect</button>
      <div className="ph-bulk-bar__sep" />
      {folders.length > 0 && (
        <div className="ph-bulk-btn-wrap">
          <button className="ph-bulk-btn" onClick={() => setMoveOpen((o) => !o)}>Move to folder</button>
          {moveOpen && (
            <>
              <div className="ph-row-menu__backdrop" onClick={() => setMoveOpen(false)} />
              <div className="ph-row-menu ph-row-menu--bulk">
                <button className="ph-row-menu__folder" onClick={() => { setMoveOpen(false); onMove(undefined); }}>No folder</button>
                {treeItems.map(({ folder, depth }) => (
                  <button key={folder.id} className="ph-row-menu__folder" style={{ paddingLeft: 10 + depth * 12 }} onClick={() => { setMoveOpen(false); onMove(folder.id); }}>
                    <Folder size={10} /> {folder.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <button className="ph-bulk-btn ph-bulk-btn--danger" onClick={onDelete}>Delete</button>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const pageNums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) pageNums.push(p);

  return (
    <div className="ph-pagination">
      <button className="ph-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {pageNums[0] > 1 && <><button className="ph-page-btn" onClick={() => onChange(1)}>1</button><span className="ph-page-ellipsis">…</span></>}
      {pageNums.map((p) => (
        <button key={p} className={`ph-page-btn${p === page ? ' ph-page-btn--active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      ))}
      {pageNums[pageNums.length - 1] < pages && <><span className="ph-page-ellipsis">…</span><button className="ph-page-btn" onClick={() => onChange(pages)}>{pages}</button></>}
      <button className="ph-page-btn" disabled={page === pages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface PromptsPageProps {
  initialFolder?: string;
}

const PER_PAGE = 20;

export default function PromptsPage({ initialFolder }: PromptsPageProps) {
  const {
    snippets, folders,
    handleDelete, handleToggleFavorite,
    handleSaveSnippet, handleUpdateSnippet,
    handleBulkDelete, handleBulkMoveToFolder, handleBulkAddTags,
    handleCreateFolder, handleDeleteFolder, handleRenameFolder,
  } = useSnippets();
  const { canCreate: canAddPrompt, count: promptCount } = useUsageLimit('prompt_hub');

  // ── UI state
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder ?? '__all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<SortCol>('savedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchQuery, activeTags, selectedFolder, sortCol, sortDir]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    snippets.forEach((sn) => sn.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [snippets]);

  // ── Folder filter (recursive subtree)
  const visibleSnippets = useMemo(() => {
    let list = snippets;

    if (selectedFolder === '__starred') {
      list = list.filter((s) => s.isFavorite);
    } else if (selectedFolder !== '__all') {
      const ids = getFolderSubtreeIds(selectedFolder, folders);
      list = list.filter((s) => s.folderId && ids.has(s.folderId));
    }

    if (activeTags.length) list = list.filter((s) => activeTags.every((t) => s.tags?.includes(t)));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        (s.title ?? '').toLowerCase().includes(q) ||
        s.text.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    const sorted = [...list];
    if (sortCol === 'savedAt') sorted.sort((a, b) => sortDir === 'desc' ? b.savedAt - a.savedAt : a.savedAt - b.savedAt);
    else if (sortCol === 'title') sorted.sort((a, b) => sortDir === 'asc' ? getSnippetTitle(a).localeCompare(getSnippetTitle(b)) : getSnippetTitle(b).localeCompare(getSnippetTitle(a)));
    else sorted.sort((a, b) => sortDir === 'desc' ? (b.usageCount ?? 0) - (a.usageCount ?? 0) : (a.usageCount ?? 0) - (b.usageCount ?? 0));
    return sorted;
  }, [snippets, folders, selectedFolder, activeTags, searchQuery, sortCol, sortDir]);

  const paginated = useMemo(() => visibleSnippets.slice((page - 1) * PER_PAGE, page * PER_PAGE), [visibleSnippets, page]);

  const openSnippet = openPromptId ? snippets.find((s) => s.id === openPromptId) ?? null : null;

  const selectionLabel =
    selectedFolder === '__all' ? 'All prompts' :
    selectedFolder === '__starred' ? 'Favorites' :
    (folders.find((f) => f.id === selectedFolder)?.name ?? 'Prompts');

  const isStarredView = initialFolder === '__starred';
  const pageTitle = isStarredView ? 'Favorites' : 'Prompt Hub';
  const pageSubtitle = isStarredView ? 'Your starred prompts.' : 'Organize and reuse prompts across every AI tool.';

  const snippetCountByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of folders) {
      counts.set(f.id, countDescendants(f.id, folders, snippets));
    }
    return counts;
  }, [folders, snippets]);

  const allCount = snippets.length;
  const starredCount = useMemo(() => snippets.filter((s) => s.isFavorite).length, [snippets]);

  // ── Handlers
  const toggleTag = (tag: string) => setActiveTags((prev) =>
    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
  );

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((s) => s.id)));
  };

  const handleBulkDeleteSelected = async () => {
    await handleBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkMoveSelected = async (folderId: string | undefined) => {
    await handleBulkMoveToFolder(Array.from(selectedIds), folderId);
    setSelectedIds(new Set());
  };

  const handleBulkTagsSelected = async (tags: string[]) => {
    await handleBulkAddTags(Array.from(selectedIds), tags);
    setSelectedIds(new Set());
  };

  const handleDuplicate = async (s: Snippet) => {
    if (!canAddPrompt) return;
    await handleSaveSnippet(
      s.title ? `${s.title} (copy)` : '',
      s.text,
      s.tags ?? [],
      s.folderId,
    );
  };

  const handleMoveRow = async (s: Snippet, folderId: string | undefined) => {
    await handleBulkMoveToFolder([s.id], folderId);
  };

  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="prompt-hub">
      {/* Page header */}
      <div className="prompt-hub__header">
        <div className="prompt-hub__breadcrumb">
          LIBRARY{isStarredView ? ' / FAVORITES' : ''}
        </div>
        <div className="prompt-hub__header-row">
          <div>
            <h1 className="prompt-hub__title">{pageTitle}</h1>
            <p className="prompt-hub__subtitle">{pageSubtitle}</p>
          </div>
          <div className="prompt-hub__header-actions">
            {promptCount !== null && (
              <span className="ph-usage-chip">
                {promptCount}/10 prompts
              </span>
            )}
            <button className="ph-btn-ghost" disabled title="Coming soon">
              ↑ Import
            </button>
            <button
              className="ph-btn-primary"
              onClick={() => setComposeOpen(true)}
              disabled={!canAddPrompt}
              title={!canAddPrompt ? 'Free plan limit reached (10/10). Upgrade to Pro for unlimited.' : undefined}
            >
              <Plus size={13} strokeWidth={2.2} /> New prompt
            </button>
          </div>
        </div>
      </div>

      {/* Search + tag filter bar */}
      <div className="prompt-hub__filter-bar">
        <div className={`ph-search${searchFocused ? ' ph-search--focused' : ''}`}>
          <Search size={13} color="var(--fg-3)" />
          <input
            className="ph-search__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search prompts…"
          />
          {searchQuery && (
            <button className="ph-search__clear" onClick={() => setSearchQuery('')}>
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="ph-filter-tags">
            <span className="ph-filter-tags__label">TAGS</span>
            {allTags.map((tag) => {
              const c = tagColor(tag);
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  className={`ph-filter-tag${active ? ' ph-filter-tag--active' : ''}`}
                  style={active ? { background: c.bg, color: c.fg, borderColor: 'transparent' } : {}}
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <button className="ph-filter-tag-clear" onClick={() => setActiveTags([])}>clear</button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="prompt-hub__body">
        {/* Folder panel */}
        <div className="ph-folder-panel">
          <div className="ph-folder-panel__scroll">
            <FolderNav
              folders={folders}
              selectedId={selectedFolder === '__all' || selectedFolder === '__starred' ? undefined : selectedFolder}
              onSelect={(id) => { setSelectedFolder(id); setSelectedIds(new Set()); }}
              snippetCountByFolder={snippetCountByFolder}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={(id) => {
                if (selectedFolder === id) setSelectedFolder('__all');
                void handleDeleteFolder(id);
              }}
              emptyMessage="No folders yet"
              topSlot={
                <>
                  <VirtualFolderRow
                    selected={selectedFolder === '__all'}
                    onClick={() => { setSelectedFolder('__all'); setSelectedIds(new Set()); }}
                    icon={<LayoutGrid size={12} strokeWidth={1.8} />}
                    label="All prompts"
                    count={allCount}
                  />
                  <VirtualFolderRow
                    selected={selectedFolder === '__starred'}
                    onClick={() => { setSelectedFolder('__starred'); setSelectedIds(new Set()); }}
                    icon={<Star size={12} strokeWidth={1.8} />}
                    label="Favorites"
                    count={starredCount}
                  />
                </>
              }
            />
          </div>
        </div>

        {/* Content panel */}
        <div className="prompt-hub__content" ref={listRef}>
          {openSnippet ? (
            <DetailPanel
              snippet={openSnippet}
              folders={folders}
              onBack={() => setOpenPromptId(null)}
              onStar={handleToggleFavorite}
              onSave={async (id, title, text) => {
                await handleUpdateSnippet(id, title, text);
              }}
              onDelete={(id) => { void handleDelete(id); setOpenPromptId(null); }}
            />
          ) : (
            <>
              {/* Table header row */}
              <div className="ph-table-topbar">
                <span className="ph-table-topbar__label">{selectionLabel}</span>
                <span className="ph-table-topbar__count">· {visibleSnippets.length}</span>
              </div>

              {selectedIds.size > 0 && (
                <BulkBar
                  count={selectedIds.size}
                  folders={folders}
                  onDelete={handleBulkDeleteSelected}
                  onMove={handleBulkMoveSelected}
                  onAddTags={handleBulkTagsSelected}
                  onClear={() => setSelectedIds(new Set())}
                />
              )}

              {snippets.length === 0 ? (
                <div className="ph-empty">
                  <Sparkles size={28} strokeWidth={1.4} />
                  <h3>Your Prompt Hub is empty</h3>
                  <p>Save prompts you reuse — tag them, organise them, send them to any AI chat.</p>
                  <button className="ph-btn-primary" onClick={() => setComposeOpen(true)}>
                    <Plus size={13} /> Save your first prompt
                  </button>
                </div>
              ) : (
                <div className="ph-table-wrap">
                  <table className="ph-table">
                    <thead>
                      <tr>
                        <th className="ph-th ph-th--check">
                          <input type="checkbox" checked={paginated.length > 0 && selectedIds.size === paginated.length} onChange={toggleAll} />
                        </th>
                        <th className="ph-th ph-th--star" />
                        <SortHeader col="title" label="PROMPT" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <th className="ph-th">SOURCE</th>
                        <th className="ph-th">TAGS</th>
                        <SortHeader col="usageCount" label="USES" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <th className="ph-th ph-th--menu" />
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr><td colSpan={7} className="ph-td-empty">No prompts match.</td></tr>
                      ) : (
                        paginated.map((s) => {
                          const title = getSnippetTitle(s);
                          const breadcrumb = s.folderId ? getFolderPath(s.folderId, folders) : null;
                          return (
                            <tr
                              key={s.id}
                              className={`ph-row${selectedIds.has(s.id) ? ' ph-row--selected' : ''}`}
                              onClick={() => setOpenPromptId(s.id)}
                            >
                              <td className="ph-td ph-td--check" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                              </td>
                              <td className="ph-td ph-td--star" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className={`ph-star-btn${s.isFavorite ? ' ph-star-btn--on' : ''}`}
                                  onClick={() => handleToggleFavorite(s.id)}
                                  title={s.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <Star size={13} strokeWidth={1.8} fill={s.isFavorite ? 'currentColor' : 'none'} />
                                </button>
                              </td>
                              <td className="ph-td ph-td--prompt">
                                <div className="ph-row__title">{title}</div>
                                {breadcrumb && <div className="ph-row__breadcrumb">{breadcrumb}</div>}
                              </td>
                              <td className="ph-td ph-td--source"><SourceBadge source={s.source} /></td>
                              <td className="ph-td ph-td--tags">
                                {(s.tags ?? []).slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}
                                {(s.tags?.length ?? 0) > 3 && <span className="ph-tags-more">+{(s.tags?.length ?? 0) - 3}</span>}
                              </td>
                              <td className="ph-td ph-td--uses">{s.usageCount ? `${s.usageCount}×` : '—'}</td>
                              <td className="ph-td ph-td--menu" onClick={(e) => e.stopPropagation()}>
                                <div className="ph-row-menu-wrap">
                                  <button className={`ph-menu-btn${rowMenuId === s.id ? ' ph-menu-btn--open' : ''}`} onClick={() => setRowMenuId(rowMenuId === s.id ? null : s.id)}>
                                    <MoreHorizontal size={14} strokeWidth={1.8} />
                                  </button>
                                  {rowMenuId === s.id && (
                                    <RowMenu
                                      snippet={s}
                                      folders={folders}
                                      onEdit={() => { setOpenPromptId(s.id); setRowMenuId(null); }}
                                      onDuplicate={() => { void handleDuplicate(s); setRowMenuId(null); }}
                                      onMove={(fid) => { void handleMoveRow(s, fid); setRowMenuId(null); }}
                                      onDelete={() => { void handleDelete(s.id); setRowMenuId(null); }}
                                      onClose={() => setRowMenuId(null)}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="ph-table-footer">
                <span className="ph-table-footer__count">
                  {visibleSnippets.length} of {snippets.length} prompt{snippets.length !== 1 ? 's' : ''}
                </span>
                <Pagination page={page} total={visibleSnippets.length} perPage={PER_PAGE} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      {composeOpen && (
        <ComposeModal
          folders={folders}
          defaultFolderId={selectedFolder !== '__all' && selectedFolder !== '__starred' ? selectedFolder : undefined}
          onCreate={async (title, text, tags, folderId) => {
            await handleSaveSnippet(title, text, tags, folderId);
          }}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}
