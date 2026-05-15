/**
 * @module PromptHubView
 * @description Full-featured prompt management view with a nested folder tree, tag/star filters, sort dropdown, inline compose card, and a slide-in detail panel supporting edit, copy, send-to-chat, duplicate, and move operations. Highlights search matches inside card text.
 * @dependencies @/types, @/utils/folder-utils, @/utils/filter-snippets, ./usePromptHubView
 * @public PromptHubView (default export)
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
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
import { usePromptHubView, type SortOrder } from './usePromptHubView';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { aiService } from '@/services/ai-service';
import { snippetStorage } from '@/services/storage/snippet-storage';
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
  newFolderParentId: string | null;
  onStartCreateFolder: (parentId: string) => void;
  onCommitCreateFolder: (name: string, parentId: string) => void;
  onCancelCreateFolder: () => void;
  onDeleteFolder: (id: string) => void;
}

function FolderTree({
  folders,
  snippets,
  selectedFolder,
  onSelectFolder,
  expandedFolders,
  onToggleFolder,
  newFolderParentId,
  onStartCreateFolder,
  onCommitCreateFolder,
  onCancelCreateFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);

  const displayItems = useMemo(() => {
    type DisplayItem =
      | { type: 'folder'; folder: FolderType; depth: number }
      | { type: 'create'; parentId: string; depth: number };

    const result: DisplayItem[] = [];
    const visibleIds = new Set<string>();

    if (newFolderParentId === '') {
      result.push({ type: 'create', parentId: '', depth: 0 });
    }

    for (const { folder, depth } of treeItems) {
      const parentVisible = !folder.parentId || (visibleIds.has(folder.parentId) && expandedFolders.has(folder.parentId));
      if (!parentVisible) continue;
      visibleIds.add(folder.id);
      result.push({ type: 'folder', folder, depth });
      if (newFolderParentId === folder.id) {
        result.push({ type: 'create', parentId: folder.id, depth: depth + 1 });
      }
    }

    return result;
  }, [treeItems, expandedFolders, newFolderParentId]);

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

      <div className="prompt-hub__folders-header">
        <span className="prompt-hub__folders-label">Folders</span>
        <button
          className="prompt-hub__folders-add"
          title="New folder"
          onClick={() => onStartCreateFolder('')}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      </div>

      {displayItems.map((item, i) =>
        item.type === 'create' ? (
          <FolderCreateRow
            key={`create-${i}`}
            depth={item.depth}
            onCommit={(name) => onCommitCreateFolder(name, item.parentId)}
            onCancel={onCancelCreateFolder}
            validate={(name) => {
              const parentIdToCheck = item.parentId || undefined;
              const siblings = folders.filter((f) => f.parentId === parentIdToCheck);
              return siblings.some((f) => f.name.toLowerCase() === name.toLowerCase())
                ? `"${name}" already exists here`
                : null;
            }}
          />
        ) : (
          <FolderRow
            key={item.folder.id}
            id={item.folder.id}
            name={item.folder.name}
            depth={item.depth}
            selected={selectedFolder === item.folder.id}
            onSelect={() => onSelectFolder(item.folder.id)}
            count={countDescendants(item.folder.id, folders, snippets)}
            icon={
              expandedFolders.has(item.folder.id)
                ? <FolderOpen size={13} strokeWidth={1.8} />
                : <Folder size={13} strokeWidth={1.8} />
            }
            hasChildren={folders.some((f) => f.parentId === item.folder.id)}
            isOpen={expandedFolders.has(item.folder.id)}
            onToggle={() => onToggleFolder(item.folder.id)}
            onCreateChild={() => onStartCreateFolder(item.folder.id)}
            onDelete={() => onDeleteFolder(item.folder.id)}
          />
        ),
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
  onCreateChild?: () => void;
  onDelete?: () => void;
}

function FolderRow({ id, name, depth, selected, onSelect, count, icon, hasChildren, isOpen, onToggle, onCreateChild, onDelete }: FolderRowProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div
        className="prompt-hub__folder-row prompt-hub__folder-row--deleting"
        style={{ paddingLeft: 8 + depth * 14 }}
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
        <span className="prompt-hub__folder-icon">{icon}</span>
        <span className="prompt-hub__folder-name">{name}</span>
        <span style={{ flex: 1 }} />
        <span className="prompt-hub__folder-delete-label">Delete?</span>
        <button
          className="prompt-hub__folder-delete-confirm"
          title="Confirm delete"
          onClick={(e) => { e.stopPropagation(); setConfirming(false); onDelete?.(); }}
        >
          <Check size={11} strokeWidth={2.2} />
        </button>
        <button
          className="prompt-hub__folder-delete-cancel"
          title="Cancel"
          onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>
    );
  }

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
      {onCreateChild && (
        <button
          className="prompt-hub__folder-add-child"
          title="New subfolder"
          onClick={(e) => { e.stopPropagation(); onCreateChild(); }}
        >
          <Plus size={11} strokeWidth={2} />
        </button>
      )}
      {onDelete && (
        <button
          className="prompt-hub__folder-delete-btn"
          title="Delete folder"
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        >
          <Trash2 size={11} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

interface FolderCreateRowProps {
  depth: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
  validate: (name: string) => string | null;
}

function FolderCreateRow({ depth, onCommit, onCancel, validate }: FolderCreateRowProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tryCommit = () => {
    const trimmed = name.trim();
    if (!trimmed) { onCancel(); return; }
    const err = validate(trimmed);
    if (err) { setError(err); return; }
    onCommit(trimmed);
  };

  return (
    <div className="prompt-hub__folder-create-row" style={{ paddingLeft: 8 + depth * 14 }}>
      <span className="prompt-hub__folder-spacer" />
      <Folder size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 3, color: error ? 'var(--error, oklch(0.55 0.18 25))' : 'var(--fg-3)' }} />
      <div className="prompt-hub__folder-create-wrap">
        <div className="prompt-hub__folder-create-input-row">
          <input
            className={`prompt-hub__folder-create-input${error ? ' prompt-hub__folder-create-input--error' : ''}`}
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); tryCommit(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }}
            onBlur={onCancel}
            autoFocus
            placeholder="Folder name"
          />
          <button
            className="prompt-hub__folder-create-confirm"
            title="Create folder"
            onMouseDown={(e) => e.preventDefault()}
            onClick={tryCommit}
          >
            <Check size={11} strokeWidth={2.2} />
          </button>
          <button
            className="prompt-hub__folder-create-cancel-btn"
            title="Cancel"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancel}
          >
            <X size={11} strokeWidth={2} />
          </button>
        </div>
        {error && <span className="prompt-hub__folder-create-error">{error}</span>}
      </div>
    </div>
  );
}

// ── Prompt card ────────────────────────────────────────────────────────────────

interface PromptCardProps {
  snippet: Snippet;
  onClick: () => void;
  onStar: (id: string) => void;
  onEnhance: () => void;
  searchQuery: string;
}

function PromptCard({ snippet, onClick, onStar, onEnhance, searchQuery }: PromptCardProps) {
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
        <button
          className="prompt-hub__card-enhance"
          onClick={(e) => { e.stopPropagation(); onEnhance(); }}
          title="Enhance with AI"
        >
          <Sparkles size={11} strokeWidth={1.8} />
        </button>
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

// ── More options menu ─────────────────────────────────────────────────────────

interface MoreOptionsMenuProps {
  snippet: Snippet;
  folders: FolderType[];
  onDuplicate: () => void;
  onMove: (folderId: string | undefined) => void;
  onClose: () => void;
}

function MoreOptionsMenu({ snippet, folders, onDuplicate, onMove, onClose }: MoreOptionsMenuProps) {
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);
  return (
    <>
      <div className="prompt-hub__more-backdrop" onClick={onClose} />
      <div className="prompt-hub__more-dropdown">
        <button className="prompt-hub__more-option" onClick={onDuplicate}>
          <Copy size={12} /> Duplicate
        </button>
        {folders.length > 0 && (
          <>
            <div className="prompt-hub__more-divider" />
            <div className="prompt-hub__more-section-label">Move to folder</div>
            <button
              className={`prompt-hub__more-folder-option${!snippet.folderId ? ' prompt-hub__more-folder-option--current' : ''}`}
              onClick={() => onMove(undefined)}
            >
              No folder
            </button>
            {treeItems.map(({ folder, depth }) => (
              <button
                key={folder.id}
                className={`prompt-hub__more-folder-option${snippet.folderId === folder.id ? ' prompt-hub__more-folder-option--current' : ''}`}
                style={{ paddingLeft: 8 + depth * 12 }}
                onClick={() => onMove(folder.id)}
              >
                <Folder size={11} /> {folder.name}
              </button>
            ))}
          </>
        )}
      </div>
    </>
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
  onDuplicate: () => void;
  onMove: (folderId: string | undefined) => void;
  autoEnhance?: boolean;
  onAutoEnhanceDone: () => void;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'no_target' | 'failed';

function PromptDetail({ snippet, folders, editing, onClose, onStar, onStartEdit, onSave, onDelete, onCopy, onDuplicate, onMove, autoEnhance, onAutoEnhanceDone }: PromptDetailProps) {
  const [editTitle, setEditTitle] = useState(getSnippetTitle(snippet));
  const [editBody, setEditBody] = useState(snippet.text);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedText, setEnhancedText] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const didAutoEnhance = useRef(false);

  const breadcrumb = useMemo(() => {
    if (!snippet.folderId) return null;
    return getFolderPath(snippet.folderId, folders);
  }, [snippet.folderId, folders]);

  const handleCopy = () => {
    onCopy(snippet.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSendToChat = async () => {
    setSendStatus('sending');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('no_tab');
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: 'SEND_TO_CHAT',
        text: snippet.text,
      }) as { ok: boolean; error?: string };
      if (resp.ok) {
        setSendStatus('sent');
        setTimeout(() => setSendStatus('idle'), 1500);
      } else if (resp.error === 'no_target') {
        setSendStatus('no_target');
        setTimeout(() => setSendStatus('idle'), 3000);
      } else {
        throw new Error(resp.error);
      }
    } catch {
      navigator.clipboard.writeText(snippet.text).catch(() => {});
      setSendStatus('failed');
      setTimeout(() => setSendStatus('idle'), 2500);
    }
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

  useEffect(() => {
    if (autoEnhance && !didAutoEnhance.current) {
      didAutoEnhance.current = true;
      onAutoEnhanceDone();
      void handleEnhance();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="prompt-hub__detail">
      <div className="prompt-hub__detail-bar">
        <button className="prompt-hub__icon-btn" title="Back" onClick={onClose}>
          <ArrowLeft size={14} />
        </button>
        {breadcrumb && (
          <div className="prompt-hub__detail-breadcrumb">{breadcrumb}</div>
        )}
        <span className="prompt-hub__detail-bar-spacer" />
        <button
          className={`prompt-hub__icon-btn${enhancing ? ' prompt-hub__icon-btn--active' : ''}`}
          title={enhancing ? 'Enhancing…' : 'Enhance with AI'}
          disabled={enhancing || editing}
          onClick={handleEnhance}
        >
          {enhancing ? <span className="prompt-hub__send-spinner" /> : <Sparkles size={14} />}
        </button>
        <button
          className="prompt-hub__icon-btn"
          title={snippet.isFavorite ? 'Unstar' : 'Star'}
          onClick={() => onStar(snippet.id)}
          style={{ color: snippet.isFavorite ? 'var(--accent)' : undefined }}
        >
          <Star size={14} strokeWidth={1.8} fill={snippet.isFavorite ? 'currentColor' : 'none'} />
        </button>
        <div className="prompt-hub__more-wrap">
          <button
            className={`prompt-hub__icon-btn${moreOpen ? ' prompt-hub__icon-btn--active' : ''}`}
            title="More options"
            onClick={() => setMoreOpen((o) => !o)}
          >
            <MoreHorizontal size={14} />
          </button>
          {moreOpen && (
            <MoreOptionsMenu
              snippet={snippet}
              folders={folders}
              onDuplicate={() => { setMoreOpen(false); onDuplicate(); }}
              onMove={(folderId) => { setMoreOpen(false); onMove(folderId); }}
              onClose={() => setMoreOpen(false)}
            />
          )}
        </div>
        <button
          className="prompt-hub__icon-btn prompt-hub__icon-btn--danger"
          title="Delete prompt"
          onClick={() => onDelete(snippet.id)}
        >
          <Trash2 size={14} />
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

      {enhancedText && (
        <div className="prompt-hub__enhance-preview">
          <div className="prompt-hub__enhance-preview-label">
            <Sparkles size={11} /> Enhanced version
          </div>
          <div className="prompt-hub__enhance-preview-text">{enhancedText}</div>
          <div className="prompt-hub__enhance-preview-actions">
            <button className="prompt-hub__btn-ghost" onClick={() => setEnhancedText(null)}>
              Discard
            </button>
            <button
              className="prompt-hub__btn-primary"
              onClick={() => {
                snippetStorage.updateSnippet(snippet.id, { text: enhancedText }).catch(() => {});
                setEnhancedText(null);
              }}
            >
              <Check size={13} /> Apply
            </button>
          </div>
        </div>
      )}

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
              className="prompt-hub__btn-primary"
              onClick={handleSendToChat}
              disabled={sendStatus === 'sending'}
              title="Insert into active chat input"
            >
              {sendStatus === 'sending' ? (
                <span className="prompt-hub__send-spinner" />
              ) : sendStatus === 'sent' ? (
                <Check size={13} />
              ) : (
                <Send size={13} />
              )}
              {sendStatus === 'sent' ? 'Sent!' : 'Send to chat'}
            </button>
          </>
        )}
      </div>
      {(sendStatus === 'no_target' || sendStatus === 'failed') && (
        <div className="prompt-hub__send-hint">
          {sendStatus === 'no_target'
            ? 'Click in the chat input first, then try again.'
            : 'Copied to clipboard — paste with Ctrl+V.'}
        </div>
      )}
      {enhanceError && (
        <div className="prompt-hub__send-hint">{enhanceError}</div>
      )}
    </div>
  );
}

// ── Compose card ───────────────────────────────────────────────────────────────

interface ComposeCardProps {
  open: boolean;
  onToggle: () => void;
  folders: FolderType[];
  defaultFolderId?: string;
  onCreate: (title: string, text: string, tags: string[], folderId?: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
}

function ComposeCard({ open, onToggle, folders, defaultFolderId, onCreate, onCreateFolder }: ComposeCardProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? '');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const treeItems = useMemo(() => getFolderTreeItems(folders), [folders]);

  const handleSubmit = () => {
    if (!body.trim()) return;
    const finalTags = tagInput.trim()
      ? [...tags, tagInput.trim().toLowerCase()]
      : tags;
    onCreate(title.trim(), body.trim(), finalTags, folderId || undefined);
    setTitle(''); setBody(''); setTags([]); setTagInput(''); setFolderId('');
  };

  const commitTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleCommitFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder(name);
    setNewFolderName('');
    setCreatingFolder(false);
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
        <div className="prompt-hub__compose-folder-row">
          {folders.length > 0 && (
            <select
              className="prompt-hub__compose-folder-select"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">No folder</option>
              {treeItems.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {'  '.repeat(depth)}{folder.name}
                </option>
              ))}
            </select>
          )}
          {creatingFolder ? (
            <div className="prompt-hub__compose-new-folder">
              <input
                className="prompt-hub__compose-folder-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitFolder();
                  if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                }}
                placeholder="Folder name…"
                autoFocus
              />
              <button className="prompt-hub__btn-ghost prompt-hub__btn-xs" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}>✕</button>
              <button className="prompt-hub__btn-primary prompt-hub__btn-xs" onClick={handleCommitFolder} disabled={!newFolderName.trim()}>
                <Check size={10} strokeWidth={2.4} />
              </button>
            </div>
          ) : (
            <button className="prompt-hub__compose-folder-create" onClick={() => setCreatingFolder(true)}>
              <Plus size={10} strokeWidth={2.2} /> {folders.length > 0 ? 'New folder' : 'Create a folder'}
            </button>
          )}
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

// ── Sort dropdown ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az',     label: 'A → Z' },
  { value: 'za',     label: 'Z → A' },
];

function SortDropdown({ current, onSelect, onClose }: { current: SortOrder; onSelect: (o: SortOrder) => void; onClose: () => void }) {
  return (
    <>
      <div className="prompt-hub__sort-backdrop" onClick={onClose} />
      <div className="prompt-hub__sort-dropdown">
        {SORT_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            className={`prompt-hub__sort-option${current === value ? ' prompt-hub__sort-option--active' : ''}`}
            onClick={() => onSelect(value)}
          >
            {current === value && <Check size={11} strokeWidth={2.4} />}
            {label}
          </button>
        ))}
      </div>
    </>
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
  handleCreateFolder: (name: string, parentId?: string) => void;
  handleDeleteFolder: (id: string) => void;
  handleMoveToFolder: (id: string, folderId: string | undefined) => void;
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
  handleCreateFolder,
  handleDeleteFolder,
  handleMoveToFolder,
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
    newFolderParentId,
    setNewFolderParentId,
    sortOrder,
    setSortOrder,
    sortOpen,
    setSortOpen,
  } = usePromptHubView();

  const { canUse: canAddPrompt, count: promptCount, use: usePromptLimit } = useUsageLimit('prompt_hub');
  const [pendingEnhance, setPendingEnhance] = useState(false);
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

    const sorted = [...list];
    if (sortOrder === 'newest') sorted.sort((a, b) => b.savedAt - a.savedAt);
    else if (sortOrder === 'oldest') sorted.sort((a, b) => a.savedAt - b.savedAt);
    else if (sortOrder === 'az') sorted.sort((a, b) => getSnippetTitle(a).localeCompare(getSnippetTitle(b)));
    else sorted.sort((a, b) => getSnippetTitle(b).localeCompare(getSnippetTitle(a)));
    return sorted;
  }, [snippets, selectedFolder, folders, starredOnly, activeTags, searchQuery, sortOrder]);

  const listLabel = searchQuery
    ? 'Results'
    : selectedFolder === '__all'
    ? 'Recent'
    : selectedFolder === '__starred'
    ? 'Favorites'
    : (folders.find((f) => f.id === selectedFolder)?.name ?? 'Prompts');

  const handleSave = (title: string, text: string) => {
    if (!openSnippet || !canAddPrompt) return;
    handleDelete(openSnippet.id);
    handleAddSnippet(title, text, openSnippet.tags ?? [], openSnippet.folderId);
    void usePromptLimit();
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
          onDuplicate={() => {
            if (!canAddPrompt) return;
            handleAddSnippet(
              openSnippet.title ? `${openSnippet.title} (copy)` : '',
              openSnippet.text,
              openSnippet.tags ?? [],
              openSnippet.folderId,
            );
            void usePromptLimit();
            closeDetail();
          }}
          onMove={(folderId) => {
            handleMoveToFolder(openSnippet.id, folderId);
            closeDetail();
          }}
          autoEnhance={pendingEnhance}
          onAutoEnhanceDone={() => setPendingEnhance(false)}
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
            <FolderTree
              folders={folders}
              snippets={snippets}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              newFolderParentId={newFolderParentId}
              onStartCreateFolder={(parentId) => setNewFolderParentId(parentId)}
              onCommitCreateFolder={(name, parentId) => {
                handleCreateFolder(name, parentId || undefined);
                setNewFolderParentId(null);
              }}
              onCancelCreateFolder={() => setNewFolderParentId(null)}
              onDeleteFolder={(id) => {
                if (selectedFolder === id) setSelectedFolder('__all');
                handleDeleteFolder(id);
              }}
            />

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

                <hr className="prompt-hub__divider" />

                <div className="prompt-hub__list-header">
                  <span className="prompt-hub__list-label">{listLabel}</span>
                  <span className="prompt-hub__list-count">· {visibleSnippets.length}</span>
                  <span className="prompt-hub__list-spacer" />
                  <div className="prompt-hub__sort-wrap">
                    <button
                      className={`prompt-hub__list-sort-btn${sortOpen ? ' prompt-hub__list-sort-btn--active' : ''}`}
                      title="Sort"
                      onClick={() => setSortOpen((o) => !o)}
                    >
                      <SlidersHorizontal size={11} />
                    </button>
                    {sortOpen && (
                      <SortDropdown
                        current={sortOrder}
                        onSelect={(o) => { setSortOrder(o); setSortOpen(false); }}
                        onClose={() => setSortOpen(false)}
                      />
                    )}
                  </div>
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
                        onEnhance={() => { openDetail(s.id); setPendingEnhance(true); }}
                        searchQuery={searchQuery}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {canAddPrompt ? (
            <ComposeCard
              open={composeOpen}
              onToggle={() => setComposeOpen(!composeOpen)}
              folders={folders}
              defaultFolderId={
                selectedFolder !== '__all' && selectedFolder !== '__starred'
                  ? selectedFolder
                  : undefined
              }
              onCreate={(title, text, tags, folderId) => {
                handleAddSnippet(title, text, tags, folderId);
                void usePromptLimit();
                setComposeOpen(false);
              }}
              onCreateFolder={handleCreateFolder}
            />
          ) : (
            <div className="prompt-hub__limit-notice">
              Daily limit reached ({promptCount}/5 prompts today).{' '}
              <button className="prompt-hub__limit-upgrade" onClick={() => chrome.runtime.openOptionsPage()}>
                Upgrade to Pro
              </button>{' '}
              for unlimited.
            </div>
          )}
        </>
      )}
    </div>
  );
}
