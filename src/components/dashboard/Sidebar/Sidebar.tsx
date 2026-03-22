import React from 'react';
import type { DashboardView } from '@/types/dashboard';
import './Sidebar.css';

interface NavItem {
  view: DashboardView;
  icon: string;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'home', icon: '⌂', label: 'Home' },
  { view: 'prompts', icon: '≡', label: 'Prompts' },
  { view: 'notebooks', icon: '◱', label: 'Notebooks' },
  { view: 'favorites', icon: '★', label: 'Favorites' },
  { view: 'folders', icon: '◫', label: 'Folders' },
  { view: 'tags', icon: '◈', label: 'Tags' },
];

const SECONDARY_NAV: NavItem[] = [
  { view: 'analytics', icon: '◉', label: 'Analytics' },
  { view: 'export-history', icon: '◎', label: 'Export History' },
];

interface SidebarProps {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  promptCount: number;
  favoritesCount: number;
  notebooksCount: number;
}

export default function Sidebar({
  currentView,
  onNavigate,
  promptCount,
  favoritesCount,
  notebooksCount,
}: SidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const isActive = currentView === item.view;
    const badge =
      item.view === 'prompts' && promptCount > 0
        ? promptCount
        : item.view === 'notebooks' && notebooksCount > 0
          ? notebooksCount
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

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon">✦</span>
        <span className="sidebar__brand-name">LLM Enhancer</span>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section-label">Menu</div>
        {PRIMARY_NAV.map(renderNavItem)}

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
