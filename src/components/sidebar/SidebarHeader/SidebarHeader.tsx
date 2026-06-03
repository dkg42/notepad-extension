/**
 * @module SidebarHeader
 * @description Top bar of the sidebar that renders the Notehublm logo on the home view and a back button with view label on sub-views. Also surfaces the dashboard link, dark/light mode toggle, and a user avatar or sign-in button.
 * @dependencies @/types
 * @public SidebarHeader (default export)
 */
import React from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  ExternalLink,
  Moon,
  Sun,
} from 'lucide-react';
import type { StoredAuthProfile } from '@/types';
import './SidebarHeader.css';

const VIEW_LABELS: Record<string, string> = {
  home: 'Notehublm',
  prompts: 'Prompt Hub',
  snippets: 'Clipboard',
  history: 'Chat Hub',
  screenshot: 'Screenshot',
  tabs: 'Tab Hub',
  notebook: 'Add to NotebookLM',
};

interface SidebarHeaderProps {
  view: string;
  dark: boolean;
  user: StoredAuthProfile | null;
  userMenuOpen: boolean;
  onBack: () => void;
  onToggleDark: () => void;
  onOpenDashboard: () => void;
  onUserClick: () => void;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(uid: string | null): string {
  if (!uid) return 'oklch(0.55 0.18 270)';
  const hues = [270, 160, 30, 320, 220, 75];
  const idx = uid.charCodeAt(0) % hues.length;
  return `oklch(0.55 0.18 ${hues[idx]})`;
}

export default function SidebarHeader({
  view,
  dark,
  user,
  userMenuOpen,
  onBack,
  onToggleDark,
  onOpenDashboard,
  onUserClick,
}: SidebarHeaderProps) {
  const isHome = view === 'home';

  return (
    <div className="sidebar-header">
      {isHome ? (
        <div className="sidebar-header__logo">
          <img
            src="/logo-mark.png"
            alt=""
            aria-hidden="true"
            className="sidebar-header__logo-mark"
          />
          <img
            src="/wordmark.png"
            alt="noteHubLM"
            className="sidebar-header__wordmark"
          />
        </div>
      ) : (
        <div className="sidebar-header__back-btn">
          <button
            className="sidebar-header__icon-btn"
            title="Back to home"
            onClick={onBack}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="sidebar-header__view-label">
            {VIEW_LABELS[view] ?? view}
          </div>
        </div>
      )}

      <div className="sidebar-header__spacer" />

      <button
        className="sidebar-header__dashboard-btn"
        title="Open dashboard in a new tab"
        onClick={onOpenDashboard}
      >
        <LayoutDashboard size={12} strokeWidth={1.8} />
        Dashboard
        <ExternalLink size={10} strokeWidth={2} />
      </button>

      <button
        className="sidebar-header__icon-btn"
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={onToggleDark}
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {user && (
        <button
          className={`sidebar-header__avatar-btn${userMenuOpen ? ' sidebar-header__avatar-btn--menu-open' : ''}`}
          title={user.displayName ?? user.email ?? 'Account'}
          style={{ background: getAvatarColor(user.uid) }}
          onClick={onUserClick}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            getInitials(user.displayName)
          )}
        </button>
      )}
    </div>
  );
}
