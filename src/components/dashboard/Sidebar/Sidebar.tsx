/**
 * @module Sidebar
 * @description Dashboard navigation sidebar with Notehublm branding, cmd-K search trigger, primary nav items, animated collapsible groups, and a footer user card.
 * @dependencies @/types, @/types/dashboard, @/services/auth-service, @/contexts/NavigationContext, @/contexts/SnippetsContext
 * @public Sidebar
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  FileText,
  Star,
  Tag,
  BookOpen,
  Database,
  Package,
  MessageSquare,
  MessagesSquare,
  Headphones,
  Play,
  Music,
  BarChart2,
  Clock,
  Settings,
  ChevronRight,
  ChevronDown,
  Zap,
  Search,
  type LucideIcon,
} from 'lucide-react';
import type { StoredAuthProfile } from '@/types';
import type { DashboardView } from '@/types/dashboard';
import { authService } from '@/services/auth-service';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSnippets } from '@/contexts/SnippetsContext';
import './Sidebar.css';

type IconComponent = LucideIcon;

interface NavItem {
  view: DashboardView;
  icon: IconComponent;
  label: string;
}

interface NavGroup {
  view: DashboardView;
  icon: IconComponent;
  label: string;
  subItems: NavItem[];
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'home', icon: Home, label: 'Home' },
  { view: 'prompts', icon: FileText, label: 'Prompt Hub' },
  { view: 'favorites', icon: Star, label: 'Favorites' },
  { view: 'tags', icon: Tag, label: 'Tags' },
];

const NOTEBOOKS_GROUP: NavGroup = {
  view: 'notebooks',
  icon: BookOpen,
  label: 'Notebooks',
  subItems: [
    { view: 'all-sources', icon: Database, label: 'All Sources' },
    { view: 'all-artifacts', icon: Package, label: 'All Artifacts' },
  ],
};

const CHAT_HISTORY_GROUP: NavGroup = {
  view: 'chat-history',
  icon: MessageSquare,
  label: 'Chat history',
  subItems: [
    { view: 'chat-history', icon: MessagesSquare, label: 'All Chats' },
  ],
};

const PODCASTS_GROUP: NavGroup = {
  view: 'podcasts',
  icon: Headphones,
  label: 'Podcasts',
  subItems: [
    { view: 'podcasts', icon: Play, label: 'Episodes' },
    { view: 'all-audio', icon: Music, label: 'All Audio' },
  ],
};

const SECONDARY_NAV: NavItem[] = [
  { view: 'analytics', icon: BarChart2, label: 'Analytics' },
  { view: 'pipelines', icon: Zap, label: 'Pipelines' },
  { view: 'export-history', icon: Clock, label: 'Export History' },
];

const NOTEBOOK_VIEWS: DashboardView[] = ['notebooks', 'notebook-detail', 'all-sources', 'all-artifacts'];
const CHAT_HISTORY_VIEWS: DashboardView[] = ['chat-history', 'chat-history-detail'];
const PODCASTS_VIEWS: DashboardView[] = ['podcasts', 'podcast-detail', 'all-audio'];

interface CollapsibleGroupProps {
  group: NavGroup;
  isExpanded: boolean;
  isGroupActive: boolean;
  currentView: DashboardView;
  badge: number;
  onToggle: () => void;
  onNavigate: (view: DashboardView) => void;
}

function CollapsibleGroup({
  group,
  isExpanded,
  isGroupActive,
  currentView,
  badge,
  onToggle,
  onNavigate,
}: CollapsibleGroupProps) {
  return (
    <div className="sidebar__group">
      <button
        className="sidebar__group-trigger"
        onClick={onToggle}
        title={group.label}
      >
        {isExpanded
          ? <ChevronDown size={9} strokeWidth={2.2} />
          : <ChevronRight size={9} strokeWidth={2.2} />}
        <span>{group.label}</span>
        {badge > 0 && (
          <span className="sidebar__nav-badge" style={{ marginLeft: 'auto' }}>{badge}</span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="sidebar__sub-items">
              {group.subItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive =
                  currentView === sub.view ||
                  (group.view === 'chat-history' &&
                    sub.view === 'chat-history' &&
                    currentView === 'chat-history-detail') ||
                  (group.view === 'podcasts' &&
                    sub.view === 'podcasts' &&
                    currentView === 'podcast-detail');

                return (
                  <button
                    key={sub.view}
                    className={`sidebar__nav-item sidebar__nav-item--sub${isSubActive ? ' sidebar__nav-item--active' : ''}`}
                    onClick={() => onNavigate(sub.view)}
                    title={sub.label}
                  >
                    <span className="sidebar__nav-icon">
                      <SubIcon size={13} strokeWidth={1.75} />
                    </span>
                    <span className="sidebar__nav-label">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Sidebar() {
  const {
    currentView,
    setCurrentView: onNavigate,
    notebooksCount,
    chatHistoryCount,
    podcastsCount,
    pipelinesCount,
    setShowCommandPalette,
  } = useNavigation();
  const { snippets, favoritesCount } = useSnippets();
  const promptCount = snippets.length;

  const [user, setUser] = useState<StoredAuthProfile | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
    return authService.onAuthStateChange(setUser);
  }, []);

  const [notebooksExpanded, setNotebooksExpanded] = useState(
    NOTEBOOK_VIEWS.includes(currentView),
  );
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(
    CHAT_HISTORY_VIEWS.includes(currentView),
  );
  const [podcastsExpanded, setPodcastsExpanded] = useState(
    PODCASTS_VIEWS.includes(currentView),
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentView === item.view;
    const badge =
      item.view === 'prompts' && promptCount > 0
        ? promptCount
        : item.view === 'favorites' && favoritesCount > 0
          ? favoritesCount
          : item.view === 'pipelines' && pipelinesCount > 0
            ? pipelinesCount
            : null;

    return (
      <button
        key={item.view}
        className={`sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
        onClick={() => onNavigate(item.view)}
        title={item.label}
      >
        <span className="sidebar__nav-icon">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <span className="sidebar__nav-label">{item.label}</span>
        {badge !== null && <span className="sidebar__nav-badge">{badge}</span>}
      </button>
    );
  };

  const handleNotebooksToggle = () => {
    if (!notebooksExpanded) {
      setNotebooksExpanded(true);
      onNavigate('notebooks');
    } else if (currentView !== 'notebooks') {
      onNavigate('notebooks');
    } else {
      setNotebooksExpanded(false);
    }
  };

  const handleChatHistoryToggle = () => {
    if (!chatHistoryExpanded) {
      setChatHistoryExpanded(true);
      onNavigate('chat-history');
    } else if (currentView !== 'chat-history') {
      onNavigate('chat-history');
    } else {
      setChatHistoryExpanded(false);
    }
  };

  const handlePodcastsToggle = () => {
    if (!podcastsExpanded) {
      setPodcastsExpanded(true);
      onNavigate('podcasts');
    } else if (currentView !== 'podcasts') {
      onNavigate('podcasts');
    } else {
      setPodcastsExpanded(false);
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-avatar">n</div>
        <div className="sidebar__brand-info">
          <span className="sidebar__brand-name">Notehublm</span>
          <span className="sidebar__brand-subtitle">Dashboard</span>
        </div>
      </div>

      {/* Cmd-K search trigger */}
      <div className="sidebar__search-wrap">
        <button
          className="sidebar__search-btn"
          onClick={() => setShowCommandPalette(true)}
        >
          <Search size={13} />
          <span>Search everything…</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="sidebar__nav">
        {PRIMARY_NAV.map(renderNavItem)}

        <CollapsibleGroup
          group={NOTEBOOKS_GROUP}
          isExpanded={notebooksExpanded}
          isGroupActive={NOTEBOOK_VIEWS.includes(currentView)}
          currentView={currentView}
          badge={notebooksCount}
          onToggle={handleNotebooksToggle}
          onNavigate={onNavigate}
        />
        <CollapsibleGroup
          group={CHAT_HISTORY_GROUP}
          isExpanded={chatHistoryExpanded}
          isGroupActive={CHAT_HISTORY_VIEWS.includes(currentView)}
          currentView={currentView}
          badge={chatHistoryCount}
          onToggle={handleChatHistoryToggle}
          onNavigate={onNavigate}
        />
        <CollapsibleGroup
          group={PODCASTS_GROUP}
          isExpanded={podcastsExpanded}
          isGroupActive={PODCASTS_VIEWS.includes(currentView)}
          currentView={currentView}
          badge={podcastsCount}
          onToggle={handlePodcastsToggle}
          onNavigate={onNavigate}
        />

        <div className="sidebar__divider" />

        {SECONDARY_NAV.map(renderNavItem)}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        {!user && (
          <div className="sidebar__upgrade-banner">
            <div className="sidebar__upgrade-banner-title">
              <Zap size={11} />
              Upgrade to Pro
            </div>
            <div className="sidebar__upgrade-banner-body">
              Unlock pipelines, NotebookLM, cloud sync. <strong>$5/mo.</strong>
            </div>
          </div>
        )}

        {user ? (
          (() => {
            const { displayName = null, email = null, photoURL = null } = user ?? {};
            return (
              <button
                className={`sidebar__user-card${currentView === 'account' ? ' sidebar__user-card--active' : ''}`}
                onClick={() => onNavigate('account')}
                title={email ?? ''}
              >
                <div className="sidebar__user-avatar">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName ?? 'User avatar'}
                      className="sidebar__user-avatar-img"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="sidebar__user-avatar-initials">
                      {getInitials(displayName ?? email ?? '?')}
                    </span>
                  )}
                </div>
                <div className="sidebar__user-info">
                  <span className="sidebar__user-name">
                    {displayName ?? email ?? 'Signed in'}
                  </span>
                  {email && displayName && (
                    <span className="sidebar__user-email">{email}</span>
                  )}
                </div>
                <span className="sidebar__user-settings-icon">
                  <Settings size={13} strokeWidth={1.75} />
                </span>
              </button>
            );
          })()
        ) : (
          <button
            className={`sidebar__nav-item${currentView === 'account' ? ' sidebar__nav-item--active' : ''}`}
            onClick={() => onNavigate('account')}
            title="Account"
          >
            <span className="sidebar__nav-label">Account</span>
          </button>
        )}

        <button
          className={`sidebar__nav-item${currentView === 'settings' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Settings"
        >
          <span className="sidebar__nav-icon">
            <Settings size={14} strokeWidth={1.75} />
          </span>
          <span className="sidebar__nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
