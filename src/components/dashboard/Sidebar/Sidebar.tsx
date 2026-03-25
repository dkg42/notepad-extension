import React, { useState } from 'react';
import type { DashboardView } from '@/types/dashboard';
import './Sidebar.css';

interface NavItem {
  view: DashboardView;
  icon: string;
  label: string;
}

interface NavItemWithSubs extends NavItem {
  subItems?: NavItem[];
}

const NOTEBOOKS_NAV: NavItemWithSubs = {
  view: 'notebooks',
  icon: '◱',
  label: 'Notebooks',
  subItems: [
    { view: 'all-sources', icon: '◇', label: 'All Sources' },
    { view: 'all-artifacts', icon: '♫', label: 'All Artifacts' },
  ],
};

const CHAT_HISTORY_NAV: NavItemWithSubs = {
  view: 'chat-history',
  icon: '▤',
  label: 'Chat History',
  subItems: [
    { view: 'chat-history', icon: '◆', label: 'All Chats' },
  ],
};

const PRIMARY_NAV: NavItem[] = [
  { view: 'home', icon: '⌂', label: 'Home' },
  { view: 'prompts', icon: '≡', label: 'Prompts' },
  { view: 'favorites', icon: '★', label: 'Favorites' },
  { view: 'folders', icon: '◫', label: 'Folders' },
  { view: 'tags', icon: '◈', label: 'Tags' },
];

const SECONDARY_NAV: NavItem[] = [
  { view: 'analytics', icon: '◉', label: 'Analytics' },
  { view: 'export-history', icon: '◎', label: 'Export History' },
];

/** Views that belong to the Notebooks group (parent + detail + sub-items). */
const NOTEBOOK_VIEWS: DashboardView[] = [
  'notebooks', 'notebook-detail', 'all-sources', 'all-artifacts',
];

/** Views that belong to the Chat History group. */
const CHAT_HISTORY_VIEWS: DashboardView[] = [
  'chat-history', 'chat-history-detail',
];

interface SidebarProps {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  promptCount: number;
  favoritesCount: number;
  notebooksCount: number;
  chatHistoryCount: number;
}

export default function Sidebar({
  currentView,
  onNavigate,
  promptCount,
  favoritesCount,
  notebooksCount,
  chatHistoryCount,
}: SidebarProps) {
  const [notebooksExpanded, setNotebooksExpanded] = useState(
    NOTEBOOK_VIEWS.includes(currentView),
  );
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(
    CHAT_HISTORY_VIEWS.includes(currentView),
  );

  const renderNavItem = (item: NavItem) => {
    const isActive = currentView === item.view;
    const badge =
      item.view === 'prompts' && promptCount > 0
        ? promptCount
        : item.view === 'favorites' && favoritesCount > 0
          ? favoritesCount
          : null;

    return (
      <button
        key={item.view}
        className={`sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
        onClick={() => onNavigate(item.view)}
        title={item.label}
      >
        <span className="sidebar__nav-icon">{item.icon}</span>
        <span className="sidebar__nav-label">{item.label}</span>
        {badge !== null && (
          <span className="sidebar__nav-badge">{badge}</span>
        )}
      </button>
    );
  };

  const isNotebookGroupActive = NOTEBOOK_VIEWS.includes(currentView);
  const isChatHistoryGroupActive = CHAT_HISTORY_VIEWS.includes(currentView);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon">✦</span>
        <span className="sidebar__brand-name">LLM Enhancer</span>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section-label">Menu</div>
        {PRIMARY_NAV.map(renderNavItem)}

        {/* Notebooks group with sub-items */}
        <button
          className={`sidebar__nav-item${isNotebookGroupActive ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => {
            if (!notebooksExpanded) {
              setNotebooksExpanded(true);
              onNavigate('notebooks');
            } else if (currentView !== 'notebooks') {
              onNavigate('notebooks');
            } else {
              setNotebooksExpanded(false);
            }
          }}
          title="Notebooks"
        >
          <span className="sidebar__nav-icon">{NOTEBOOKS_NAV.icon}</span>
          <span className="sidebar__nav-label">{NOTEBOOKS_NAV.label}</span>
          {notebooksCount > 0 && (
            <span className="sidebar__nav-badge">{notebooksCount}</span>
          )}
          <span className={`sidebar__nav-caret${notebooksExpanded ? ' sidebar__nav-caret--open' : ''}`}>
            &#x25B8;
          </span>
        </button>

        {notebooksExpanded && NOTEBOOKS_NAV.subItems && (
          <div className="sidebar__sub-items">
            {NOTEBOOKS_NAV.subItems.map((sub) => (
              <button
                key={sub.view}
                className={`sidebar__nav-item sidebar__nav-item--sub${currentView === sub.view ? ' sidebar__nav-item--active' : ''}`}
                onClick={() => onNavigate(sub.view)}
                title={sub.label}
              >
                <span className="sidebar__nav-icon">{sub.icon}</span>
                <span className="sidebar__nav-label">{sub.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat History group with sub-items */}
        <button
          className={`sidebar__nav-item${isChatHistoryGroupActive ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => {
            if (!chatHistoryExpanded) {
              setChatHistoryExpanded(true);
              onNavigate('chat-history');
            } else if (currentView !== 'chat-history') {
              onNavigate('chat-history');
            } else {
              setChatHistoryExpanded(false);
            }
          }}
          title="Chat History"
        >
          <span className="sidebar__nav-icon">{CHAT_HISTORY_NAV.icon}</span>
          <span className="sidebar__nav-label">{CHAT_HISTORY_NAV.label}</span>
          {chatHistoryCount > 0 && (
            <span className="sidebar__nav-badge">{chatHistoryCount}</span>
          )}
          <span className={`sidebar__nav-caret${chatHistoryExpanded ? ' sidebar__nav-caret--open' : ''}`}>
            &#x25B8;
          </span>
        </button>

        {chatHistoryExpanded && CHAT_HISTORY_NAV.subItems && (
          <div className="sidebar__sub-items">
            {CHAT_HISTORY_NAV.subItems.map((sub) => (
              <button
                key={sub.view}
                className={`sidebar__nav-item sidebar__nav-item--sub${currentView === sub.view || (sub.view === 'chat-history' && currentView === 'chat-history-detail') ? ' sidebar__nav-item--active' : ''}`}
                onClick={() => onNavigate(sub.view)}
                title={sub.label}
              >
                <span className="sidebar__nav-icon">{sub.icon}</span>
                <span className="sidebar__nav-label">{sub.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sidebar__section-label">More</div>
        {SECONDARY_NAV.map(renderNavItem)}
      </nav>

      <div className="sidebar__footer">
        <button
          className={`sidebar__nav-item${currentView === 'settings' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Settings"
        >
          <span className="sidebar__nav-icon">⚙</span>
          <span className="sidebar__nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
