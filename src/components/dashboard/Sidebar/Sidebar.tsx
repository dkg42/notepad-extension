/**
 * @module Sidebar
 * @description Dashboard navigation sidebar with Notehublm branding, cmd-K search trigger, primary nav items, animated collapsible groups, and a footer user card.
 * @dependencies @/types, @/types/dashboard, @/services/auth-service, @/contexts/NavigationContext, @/contexts/SnippetsContext
 * @public Sidebar
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  FileText,
  Tag,
  BookOpen,
  Database,
  Package,
  MessageSquare,
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
  Camera,
  GitCompare,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardView } from '@/types/dashboard';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSnippets } from '@/contexts/SnippetsContext';
import { useTheme } from '@/components/dashboard/ThemeProvider/useTheme';
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

const HOME_NAV: NavItem = { view: 'home', icon: Home, label: 'Home' };
const PROMPTS_NAV: NavItem = { view: 'prompts', icon: FileText, label: 'Prompt Hub' };
const TAIL_NAV: NavItem[] = [
  { view: 'tags', icon: Tag, label: 'Tags' },
  { view: 'screenshots', icon: Camera, label: 'Screenshots' },
];

const NOTEBOOKS_GROUP: NavGroup = {
  view: 'notebooks',
  icon: BookOpen,
  label: 'Notebooks',
  subItems: [
    { view: 'notebooks', icon: BookOpen, label: 'All Notebooks' },
    { view: 'all-sources', icon: Database, label: 'All Sources' },
    { view: 'all-artifacts', icon: Package, label: 'All Artifacts' },
    { view: 'source-diff', icon: GitCompare, label: 'Source Diff' },
  ],
};

const CHAT_HUB_NAV: NavItem = { view: 'chat-history', icon: MessageSquare, label: 'Chat Hub' };

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

const NOTEBOOK_VIEWS: DashboardView[] = ['notebooks', 'notebook-detail', 'all-sources', 'all-artifacts', 'source-diff'];
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
                    currentView === 'podcast-detail') ||
                  (group.view === 'notebooks' &&
                    sub.view === 'notebooks' &&
                    currentView === 'notebook-detail');

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

export default function Sidebar() {
  const {
    currentView,
    setCurrentView: onNavigate,
    notebooksCount,
    podcastsCount,
    pipelinesCount,
    setShowCommandPalette,
    handleSettingsChange,
  } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const { snippets } = useSnippets();
  const promptCount = snippets.length;

  const [notebooksExpanded, setNotebooksExpanded] = useState(
    NOTEBOOK_VIEWS.includes(currentView),
  );
  const [podcastsExpanded, setPodcastsExpanded] = useState(
    PODCASTS_VIEWS.includes(currentView),
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      currentView === item.view ||
      (item.view === 'screenshots' && currentView === 'screenshot-editor');
    const badge =
      item.view === 'prompts' && promptCount > 0
        ? promptCount
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
        <div className="sidebar__brand-lockup">
          <img
            src="/logo-mark.png"
            alt=""
            aria-hidden="true"
            className="sidebar__brand-avatar"
          />
          <img
            src="/wordmark.png"
            alt="noteHubLM"
            className="sidebar__brand-wordmark"
          />
        </div>
        <span className="sidebar__brand-subtitle">Dashboard</span>
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
        {renderNavItem(HOME_NAV)}

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
          group={PODCASTS_GROUP}
          isExpanded={podcastsExpanded}
          isGroupActive={PODCASTS_VIEWS.includes(currentView)}
          currentView={currentView}
          badge={podcastsCount}
          onToggle={handlePodcastsToggle}
          onNavigate={onNavigate}
        />

        {renderNavItem(PROMPTS_NAV)}
        {renderNavItem(CHAT_HUB_NAV)}

        {TAIL_NAV.map(renderNavItem)}

        <div className="sidebar__divider" />

        {SECONDARY_NAV.map(renderNavItem)}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <button
          className="sidebar__nav-item"
          onClick={() => {
            toggleTheme();
            void handleSettingsChange({ theme: theme === 'light' ? 'dark' : 'light' });
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="sidebar__nav-icon">
            {theme === 'dark'
              ? <Sun size={14} strokeWidth={1.75} />
              : <Moon size={14} strokeWidth={1.75} />}
          </span>
          <span className="sidebar__nav-label">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

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
