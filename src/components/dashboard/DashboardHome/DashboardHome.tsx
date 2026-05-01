/**
 * @module DashboardHome
 * @description Landing page of the dashboard showing summary stat cards (total prompts, folders, tags), a recent-prompts list, and quick-action buttons for navigating to key views.
 * @dependencies @/types, @/types/dashboard, ./useDashboardHome
 * @public DashboardHome
 */
import React from 'react';
import type { Folder, Snippet } from '@/types';
import type { DashboardView } from '@/types/dashboard';
import { useDashboardHome } from './useDashboardHome';
import './DashboardHome.css';

interface DashboardHomeProps {
  snippets: Snippet[];
  folders: Folder[];
  onNavigate: (view: DashboardView) => void;
}

export default function DashboardHome({ snippets, folders, onNavigate }: DashboardHomeProps) {
  const { totalTags, recentSnippets, folderMap } = useDashboardHome(snippets, folders);

  return (
    <div className="dashboard-home">
      <h1 className="dashboard-home__heading">Dashboard</h1>
      <p className="dashboard-home__subheading">
        Overview of your saved prompts and resources.
      </p>

      <div className="dashboard-home__stats">
        <div className="stat-card">
          <span className="stat-card__icon">≡</span>
          <div className="stat-card__value">{snippets.length}</div>
          <div className="stat-card__label">Total Prompts</div>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon">◫</span>
          <div className="stat-card__value">{folders.length}</div>
          <div className="stat-card__label">Folders</div>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon">◈</span>
          <div className="stat-card__value">{totalTags}</div>
          <div className="stat-card__label">Unique Tags</div>
        </div>
      </div>

      <div className="dashboard-home__sections">
        <div className="dashboard-home__section">
          <div className="dashboard-home__section-header">
            <span className="dashboard-home__section-title">Recent Prompts</span>
            <button
              className="dashboard-home__section-link"
              onClick={() => onNavigate('prompts')}
            >
              View all →
            </button>
          </div>
          {recentSnippets.length === 0 ? (
            <p className="dashboard-home__empty">No prompts saved yet.</p>
          ) : (
            <ul className="dashboard-home__recent-list">
              {recentSnippets.map((s) => (
                <li key={s.id} className="dashboard-home__recent-item">
                  <span className="dashboard-home__recent-text">
                    {s.text.slice(0, 80)}{s.text.length > 80 ? '…' : ''}
                  </span>
                  {s.folderId && (
                    <span className="dashboard-home__recent-folder">
                      {folderMap.get(s.folderId) ?? ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-home__section">
          <div className="dashboard-home__section-header">
            <span className="dashboard-home__section-title">Quick Actions</span>
          </div>
          <div className="dashboard-home__actions">
            <button
              className="dashboard-home__action-btn"
              onClick={() => onNavigate('prompts')}
            >
              <span className="dashboard-home__action-icon">≡</span>
              Browse all prompts
            </button>
            <button
              className="dashboard-home__action-btn"
              onClick={() => onNavigate('folders')}
            >
              <span className="dashboard-home__action-icon">◫</span>
              Manage folders
            </button>
            <button
              className="dashboard-home__action-btn"
              onClick={() => onNavigate('tags')}
            >
              <span className="dashboard-home__action-icon">◈</span>
              Manage tags
            </button>
            <button
              className="dashboard-home__action-btn"
              onClick={() => onNavigate('analytics')}
            >
              <span className="dashboard-home__action-icon">◉</span>
              View analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
