/**
 * @module TabManagerView
 * @description Sidebar view for the Tab Manager — accordion layout showing ungrouped
 *   open tabs and user-defined tab groups with color coding, context notes, and
 *   bulk actions (open all, close all). Free plan is limited to 3 groups.
 * @dependencies useTabManagerView
 * @public TabManagerView (default export)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  Pencil,
  Star,
  MoreHorizontal,
  Plus,
  Sparkles,
  Check,
  Trash2,
} from 'lucide-react';
import type { TabGroup, StashedTab, GroupColor } from '@/types/tab-groups';
import { useTabManagerView, FREE_PLAN_MAX_GROUPS, COLORS } from './useTabManagerView';
import './TabManagerView.css';

const COLOR_MAP: Record<GroupColor, { bar: string; soft: string; fg: string }> = {
  primary: { bar: 'var(--primary)',        soft: 'var(--primary-soft)',   fg: 'var(--primary-soft-fg)' },
  green:   { bar: 'oklch(0.62 0.13 150)', soft: 'var(--tag-2-bg)',       fg: 'var(--tag-2-fg)' },
  sky:     { bar: 'oklch(0.65 0.13 235)', soft: 'var(--tag-5-bg)',       fg: 'var(--tag-5-fg)' },
  rose:    { bar: 'oklch(0.65 0.16 15)',  soft: 'var(--tag-1-bg)',       fg: 'var(--tag-1-fg)' },
  violet:  { bar: 'oklch(0.6 0.16 290)',  soft: 'var(--tag-4-bg)',       fg: 'var(--tag-4-fg)' },
};

// ── Favicon ───────────────────────────────────────────────────────────────────

function TabFavicon({ url, title }: { url?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="tab-manager-view__favicon-fallback">
        {(title[0] ?? '?').toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      className="tab-manager-view__favicon"
      onError={() => setFailed(true)}
      alt=""
    />
  );
}

// ── Tab row ───────────────────────────────────────────────────────────────────

interface TabRowProps {
  tab: chrome.tabs.Tab;
  onClose: () => void;
  dense?: boolean;
  actions?: React.ReactNode;
}

function TabRow({ tab, onClose, dense = false, actions }: TabRowProps) {
  const hostname = (() => {
    try { return new URL(tab.url ?? '').hostname; } catch { return tab.url ?? ''; }
  })();

  return (
    <div
      className={`tab-manager-view__tab-row${dense ? ' tab-manager-view__tab-row--dense' : ''}`}
      onClick={() => tab.id != null && chrome.tabs.update(tab.id, { active: true }).catch(() => {})}
    >
      <TabFavicon url={tab.favIconUrl} title={tab.title ?? '?'} />
      <div className="tab-manager-view__tab-info">
        <div className="tab-manager-view__tab-title">{tab.title ?? 'Untitled'}</div>
        {!dense && (
          <div className="tab-manager-view__tab-url">{hostname}</div>
        )}
      </div>
      {actions}
      <button
        className="tab-manager-view__tab-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close tab"
      >
        <X size={11} strokeWidth={1.8} />
      </button>
    </div>
  );
}

// ── Stashed tab row ───────────────────────────────────────────────────────────

interface StashedTabRowProps {
  stashedTab: StashedTab;
  onReopen: () => void;
  onRemove: () => void;
}

function StashedTabRow({ stashedTab, onReopen, onRemove }: StashedTabRowProps) {
  const hostname = (() => {
    try { return new URL(stashedTab.url).hostname; } catch { return stashedTab.url; }
  })();

  return (
    <div className="tab-manager-view__stashed-row">
      <TabFavicon url={stashedTab.favIconUrl} title={stashedTab.title} />
      <div className="tab-manager-view__tab-info">
        <div className="tab-manager-view__tab-title">{stashedTab.title}</div>
        <div className="tab-manager-view__tab-url">{hostname}</div>
      </div>
      <button
        className="tab-manager-view__stashed-reopen-btn"
        onClick={(e) => { e.stopPropagation(); onReopen(); }}
        title="Reopen tab"
      >
        <ExternalLink size={11} strokeWidth={1.8} />
      </button>
      <button
        className="tab-manager-view__tab-close"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove from group"
      >
        <X size={11} strokeWidth={1.8} />
      </button>
    </div>
  );
}

// ── Context block ─────────────────────────────────────────────────────────────

interface ContextBlockProps {
  context: string;
  aiContext: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function ContextBlock({ context, aiContext, isEditing, onEdit, onSave, onCancel }: ContextBlockProps) {
  const [draft, setDraft] = useState(context);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(context);
      textareaRef.current?.focus();
    }
  }, [isEditing, context]);

  return (
    <div className={`tab-manager-view__context${aiContext ? ' tab-manager-view__context--ai' : ''}`}>
      <div className={`tab-manager-view__context-icon${aiContext ? ' tab-manager-view__context-icon--ai' : ''}`}>
        {aiContext ? <Sparkles size={9} strokeWidth={2.2} /> : <Pencil size={9} strokeWidth={2.2} />}
      </div>
      <div className="tab-manager-view__context-body">
        <div className="tab-manager-view__context-label-row">
          <span className="tab-manager-view__context-label">
            {aiContext ? 'AI summary' : 'Your note'}
          </span>
          <button
            className="tab-manager-view__context-generate-btn"
            disabled
            title="AI summary — coming soon"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles size={9} strokeWidth={2.2} />
          </button>
        </div>
        {isEditing ? (
          <div className="tab-manager-view__context-edit">
            <textarea
              ref={textareaRef}
              className="tab-manager-view__context-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a note about this group…"
              rows={3}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="tab-manager-view__context-actions">
              <button
                className="tab-manager-view__context-save"
                onClick={(e) => { e.stopPropagation(); onSave(draft); }}
              >
                <Check size={11} strokeWidth={2.2} />
                Save
              </button>
              <button
                className="tab-manager-view__context-cancel"
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="tab-manager-view__context-text"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            {context || <span className="tab-manager-view__context-placeholder">Add a note… (click to edit)</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Color picker ──────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: GroupColor; onChange: (c: GroupColor) => void }) {
  return (
    <div className="tab-manager-view__color-picker">
      {COLORS.map((c) => (
        <button
          key={c}
          className={`tab-manager-view__color-dot${value === c ? ' tab-manager-view__color-dot--active' : ''}`}
          style={{ background: COLOR_MAP[c].bar }}
          onClick={() => onChange(c)}
          title={c}
          type="button"
        />
      ))}
    </div>
  );
}

// ── New group inline form ─────────────────────────────────────────────────────

interface NewGroupFormProps {
  name: string;
  color: GroupColor;
  onNameChange: (v: string) => void;
  onColorChange: (c: GroupColor) => void;
  onCreate: () => void;
  onCancel: () => void;
}

function NewGroupForm({ name, color, onNameChange, onColorChange, onCreate, onCancel }: NewGroupFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="tab-manager-view__new-group-form">
      <input
        ref={inputRef}
        className="tab-manager-view__new-group-input"
        placeholder="Group name…"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCreate();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <ColorPicker value={color} onChange={onColorChange} />
      <div className="tab-manager-view__new-group-btns">
        <button
          className="tab-manager-view__new-group-create"
          onClick={onCreate}
          disabled={!name.trim()}
        >
          Create
        </button>
        <button className="tab-manager-view__new-group-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Header strip ──────────────────────────────────────────────────────────────

interface HeaderStripProps {
  totalTabs: number;
  groupCount: number;
  atLimit: boolean;
  onNewGroup: () => void;
}

function HeaderStrip({ totalTabs, groupCount, atLimit, onNewGroup }: HeaderStripProps) {
  const pct = Math.min(100, (groupCount / FREE_PLAN_MAX_GROUPS) * 100);

  return (
    <div className="tab-manager-view__header-strip">
      <div className="tab-manager-view__header-stats">
        <div className="tab-manager-view__header-counts">
          <span className="tab-manager-view__header-tab-count">{totalTabs} tabs</span>
          <span className="tab-manager-view__header-group-count">
            · {groupCount} of {FREE_PLAN_MAX_GROUPS} groups
          </span>
        </div>
        <div className="tab-manager-view__progress-track">
          <div
            className={`tab-manager-view__progress-fill${atLimit ? ' tab-manager-view__progress-fill--full' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <button
        className="tab-manager-view__new-btn"
        onClick={onNewGroup}
        disabled={atLimit}
        title={atLimit ? 'Free plan: 3 groups max' : 'Create a new group'}
      >
        <Plus size={11} strokeWidth={2.4} />
        New group
      </button>
    </div>
  );
}

// ── More menu ─────────────────────────────────────────────────────────────────

interface MoreMenuProps {
  groupId: string;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function MoreMenu({ open, onToggle, onDelete }: MoreMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="tab-manager-view__more-wrap">
      <button
        className="tab-manager-view__action-btn"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="More"
      >
        <MoreHorizontal size={11} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="tab-manager-view__more-menu">
          <button
            className="tab-manager-view__more-item tab-manager-view__more-item--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={12} strokeWidth={1.8} />
            Delete group
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add to group dropdown ─────────────────────────────────────────────────────

interface AddToGroupProps {
  groups: TabGroup[];
  open: boolean;
  onToggle: () => void;
  onAdd: (groupId: string) => void;
}

function AddToGroupDropdown({ groups, open, onToggle, onAdd }: AddToGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="tab-manager-view__add-wrap">
      <button
        className="tab-manager-view__add-btn"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="Add to group"
      >
        <Plus size={11} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="tab-manager-view__add-menu">
          {groups.length === 0 ? (
            <div className="tab-manager-view__add-empty">No groups yet</div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                className="tab-manager-view__add-item"
                onClick={(e) => { e.stopPropagation(); onAdd(g.id); }}
              >
                <span
                  className="tab-manager-view__add-dot"
                  style={{ background: COLOR_MAP[g.color].bar }}
                />
                {g.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Ungrouped section ─────────────────────────────────────────────────────────

interface UngroupedSectionProps {
  tabs: chrome.tabs.Tab[];
  groups: TabGroup[];
  onClose: (tabId: number) => void;
  onAddToGroup: (tabId: number, groupId: string) => void;
}

function UngroupedSection({ tabs, groups, onClose, onAddToGroup }: UngroupedSectionProps) {
  const [addingTabId, setAddingTabId] = useState<number | null>(null);

  if (tabs.length === 0) return null;

  return (
    <div className="tab-manager-view__ungrouped">
      <div className="tab-manager-view__ungrouped-header">
        <span className="tab-manager-view__ungrouped-label">
          Ungrouped · {tabs.length}
        </span>
        <span className="tab-manager-view__ungrouped-divider" />
      </div>
      <div className="tab-manager-view__ungrouped-list">
        {tabs.map((tab) => (
          <TabRow
            key={tab.id}
            tab={tab}
            dense
            onClose={() => tab.id != null && onClose(tab.id)}
            actions={
              <AddToGroupDropdown
                groups={groups}
                open={addingTabId === tab.id}
                onToggle={() => setAddingTabId((prev) => (prev === tab.id ? null : (tab.id ?? null)))}
                onAdd={(groupId) => {
                  if (tab.id != null) onAddToGroup(tab.id, groupId);
                  setAddingTabId(null);
                }}
              />
            }
          />
        ))}
      </div>
    </div>
  );
}

// ── Tab group accordion card ──────────────────────────────────────────────────

interface TabGroupCardProps {
  group: TabGroup;
  tabs: chrome.tabs.Tab[];
  expanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onColorChange: (c: GroupColor) => void;
  onContextChange: (context: string) => void;
  onOpenAll: () => void;
  onCloseAll: () => void;
  onCloseTab: (tabId: number) => void;
  onRemoveTab: (tabId: number) => void;
  onReopenStashedTab: (url: string) => void;
  onRemoveStashedTab: (url: string) => void;
}

function TabGroupCard({
  group,
  tabs,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onTogglePin,
  onColorChange,
  onContextChange,
  onOpenAll,
  onCloseAll,
  onCloseTab,
  onRemoveTab,
  onReopenStashedTab,
  onRemoveStashedTab,
}: TabGroupCardProps) {
  const c = COLOR_MAP[group.color];
  const [isRenamingInline, setIsRenamingInline] = useState(false);
  const [renameValue, setRenameValue] = useState(group.name);
  const [isEditingContext, setIsEditingContext] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenamingInline) {
      setRenameValue(group.name);
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [isRenamingInline, group.name]);

  const commitRename = () => {
    if (renameValue.trim()) onRename(renameValue.trim());
    setIsRenamingInline(false);
  };

  const liveTabs = tabs.filter((t) => t.id != null && group.tabIds.includes(t.id!));
  const stashedTabs = group.stashedTabs ?? [];

  return (
    <div className="tab-manager-view__group">
      {/* Group header */}
      <div
        className={`tab-manager-view__group-header${expanded ? ' tab-manager-view__group-header--expanded' : ''}`}
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown size={11} strokeWidth={1.8} className="tab-manager-view__group-chevron" />
          : <ChevronRight size={11} strokeWidth={1.8} className="tab-manager-view__group-chevron" />
        }
        <button
          className="tab-manager-view__color-bar-btn"
          style={{ background: c.bar }}
          onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
          title="Change color"
        />
        {isRenamingInline ? (
          <input
            ref={renameRef}
            className="tab-manager-view__rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenamingInline(false);
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tab-manager-view__group-name">{group.name}</span>
        )}
        {group.pinned && (
          <Star size={10} fill="currentColor" strokeWidth={0} className="tab-manager-view__pin-icon" />
        )}
        <span className="tab-manager-view__group-count">
          {liveTabs.length}
          {stashedTabs.length > 0 && (
            <span className="tab-manager-view__group-stashed">+{stashedTabs.length}</span>
          )}
        </span>
        {expanded && (
          <div className="tab-manager-view__action-bar" onClick={(e) => e.stopPropagation()}>
            <button className="tab-manager-view__action-btn" onClick={onOpenAll} title="Open all">
              <ExternalLink size={11} strokeWidth={1.8} />
            </button>
            <button className="tab-manager-view__action-btn" onClick={onCloseAll} title="Close all">
              <X size={11} strokeWidth={1.8} />
            </button>
            <button
              className="tab-manager-view__action-btn"
              onClick={() => setIsRenamingInline(true)}
              title="Rename"
            >
              <Pencil size={11} strokeWidth={1.8} />
            </button>
            <button
              className={`tab-manager-view__action-btn${group.pinned ? ' tab-manager-view__action-btn--active' : ''}`}
              onClick={onTogglePin}
              title={group.pinned ? 'Unpin' : 'Pin'}
            >
              <Star size={11} strokeWidth={1.8} fill={group.pinned ? 'currentColor' : 'none'} />
            </button>
            <MoreMenu
              groupId={group.id}
              open={moreOpen}
              onToggle={() => setMoreOpen((v) => !v)}
              onDelete={() => { setMoreOpen(false); onDelete(); }}
            />
          </div>
        )}
      </div>

      {/* Color picker popover */}
      {showColorPicker && (
        <div className="tab-manager-view__color-popover" onClick={(e) => e.stopPropagation()}>
          <ColorPicker
            value={group.color}
            onChange={(c) => { onColorChange(c); setShowColorPicker(false); }}
          />
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="tab-manager-view__group-body">
          <ContextBlock
            context={group.context}
            aiContext={group.aiContext}
            isEditing={isEditingContext}
            onEdit={() => setIsEditingContext(true)}
            onSave={(val) => { onContextChange(val); setIsEditingContext(false); }}
            onCancel={() => setIsEditingContext(false)}
          />
          {liveTabs.length === 0 && stashedTabs.length === 0 && (
            <div className="tab-manager-view__stashed-hint">
              No open tabs in this group yet
            </div>
          )}
          <div className="tab-manager-view__group-tabs">
            {liveTabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                onClose={() => {
                  if (tab.id != null) onCloseTab(tab.id);
                }}
              />
            ))}
          </div>
          {stashedTabs.length > 0 && (
            <div className="tab-manager-view__stashed-section">
              <div className="tab-manager-view__stashed-label">
                Stashed · {stashedTabs.length}
              </div>
              {stashedTabs.map((s) => (
                <StashedTabRow
                  key={s.url}
                  stashedTab={s}
                  onReopen={() => onReopenStashedTab(s.url)}
                  onRemove={() => onRemoveStashedTab(s.url)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upgrade banner ────────────────────────────────────────────────────────────

function UpgradeBanner() {
  return (
    <div className="tab-manager-view__upgrade">
      <div className="tab-manager-view__upgrade-title">Free plan: 3 of 3 groups</div>
      <div className="tab-manager-view__upgrade-desc">
        Upgrade to Pro for unlimited groups, custom colors, and shared sessions.
      </div>
      <button className="tab-manager-view__upgrade-btn">Upgrade — $5/mo</button>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function TabManagerView() {
  const {
    openTabs,
    groups,
    ungroupedTabs,
    expandedId,
    toggleExpanded,
    isCreatingGroup,
    setIsCreatingGroup,
    newGroupName,
    setNewGroupName,
    newGroupColor,
    setNewGroupColor,
    atGroupLimit,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleTogglePin,
    handleColorChange,
    handleContextChange,
    handleAddTabToGroup,
    handleRemoveTabFromGroup,
    handleOpenAllTabs,
    handleCloseAllTabs,
    handleCloseTab,
    handleReopenStashedTab,
    handleRemoveStashedTab,
  } = useTabManagerView();

  return (
    <div className="tab-manager-view">
      <HeaderStrip
        totalTabs={openTabs.length}
        groupCount={groups.length}
        atLimit={atGroupLimit}
        onNewGroup={() => setIsCreatingGroup(true)}
      />

      <div className="tab-manager-view__scroll">
        {isCreatingGroup && (
          <NewGroupForm
            name={newGroupName}
            color={newGroupColor}
            onNameChange={setNewGroupName}
            onColorChange={setNewGroupColor}
            onCreate={() => void handleCreateGroup()}
            onCancel={() => { setIsCreatingGroup(false); setNewGroupName(''); }}
          />
        )}

        <UngroupedSection
          tabs={ungroupedTabs}
          groups={groups}
          onClose={(tabId) => void handleCloseTab(tabId)}
          onAddToGroup={(tabId, groupId) => void handleAddTabToGroup(tabId, groupId)}
        />

        <div className="tab-manager-view__groups">
          {groups.map((group) => (
            <TabGroupCard
              key={group.id}
              group={group}
              tabs={openTabs}
              expanded={expandedId === group.id}
              onToggle={() => toggleExpanded(group.id)}
              onRename={(name) => void handleRenameGroup(group.id, name)}
              onDelete={() => void handleDeleteGroup(group.id)}
              onTogglePin={() => void handleTogglePin(group.id)}
              onColorChange={(c) => void handleColorChange(group.id, c)}
              onContextChange={(ctx) => void handleContextChange(group.id, ctx)}
              onOpenAll={() => handleOpenAllTabs(group.id)}
              onCloseAll={() => void handleCloseAllTabs(group.id)}
              onCloseTab={(tabId) => void handleCloseTab(tabId)}
              onRemoveTab={(tabId) => void handleRemoveTabFromGroup(tabId, group.id)}
              onReopenStashedTab={(url) => handleReopenStashedTab(url)}
              onRemoveStashedTab={(url) => void handleRemoveStashedTab(url, group.id)}
            />
          ))}
        </div>

        {atGroupLimit && <UpgradeBanner />}

        {groups.length === 0 && !isCreatingGroup && (
          <div className="tab-manager-view__empty">
            Create a group to start organizing your open tabs.
          </div>
        )}
      </div>
    </div>
  );
}
