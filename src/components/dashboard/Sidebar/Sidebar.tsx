import React, { useState } from 'react';
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
  Sparkles,
  Zap,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardView } from '@/types/dashboard';
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
  { view: 'prompts', icon: FileText, label: 'Prompts' },
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
  label: 'Chat History',
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
  { view: 'export-history', icon: Clock, label: 'Export History' },
  { view: 'pipelines', icon: Zap, label: 'Pipelines' },
];

const NOTEBOOK_VIEWS: DashboardView[] = ['notebooks', 'notebook-detail', 'all-sources', 'all-artifacts'];
const CHAT_HISTORY_VIEWS: DashboardView[] = ['chat-history', 'chat-history-detail'];
const PODCASTS_VIEWS: DashboardView[] = ['podcasts', 'podcast-detail', 'all-audio'];

interface SidebarProps {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  promptCount: number;
  favoritesCount: number;
  notebooksCount: number;
  chatHistoryCount: number;
  podcastsCount: number;
  pipelinesCount: number;
}

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
  const Icon = group.icon;

  return (
    <div className="sidebar__group">
      <button
        className={`sidebar__nav-item${isGroupActive ? ' sidebar__nav-item--active' : ''}`}
        onClick={onToggle}
        title={group.label}
      >
        <Icon size={16} strokeWidth={1.75} />
        <span className="sidebar__nav-label">{group.label}</span>
        {badge > 0 && <span className="sidebar__nav-badge">{badge}</span>}
        <motion.span
          className="sidebar__nav-caret"
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight size={12} strokeWidth={2} />
        </motion.span>
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
                    <SubIcon size={14} strokeWidth={1.75} />
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

export default function Sidebar({
  currentView,
  onNavigate,
  promptCount,
  favoritesCount,
  notebooksCount,
  chatHistoryCount,
  podcastsCount,
  pipelinesCount,
}: SidebarProps) {
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
        <Icon size={16} strokeWidth={1.75} />
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
      {/* Brand section */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-avatar">
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <div className="sidebar__brand-info">
          <span className="sidebar__brand-name">LLM Enhancer</span>
          <span className="sidebar__brand-version">v1.0.0</span>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="sidebar__nav">
        <div className="sidebar__section-label">Menu</div>
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

        <div className="sidebar__section-label">More</div>
        {SECONDARY_NAV.map(renderNavItem)}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <button
          className={`sidebar__nav-item${currentView === 'account' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('account')}
          title="Account"
        >
          <User size={16} strokeWidth={1.75} />
          <span className="sidebar__nav-label">Account</span>
        </button>
        <button
          className={`sidebar__nav-item${currentView === 'settings' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Settings"
        >
          <Settings size={16} strokeWidth={1.75} />
          <span className="sidebar__nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
