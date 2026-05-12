/**
 * Static visual shell rendered behind the frosted-glass auth overlay.
 * No hooks, no effects, no chrome.runtime calls — purely presentational.
 */
import React from 'react';
import '@/components/dashboard/Sidebar/Sidebar.css';
import '@/components/dashboard/DashboardHome/DashboardHome.css';
import './DashboardApp/DashboardApp.css';

const NAV_ITEMS = [
  'Home', 'Prompt Hub', 'Favorites', 'Tags', 'Screenshots',
];

const GROUP_LABELS = ['Notebooks', 'Chat history', 'Podcasts'];

const SECONDARY = ['Analytics', 'Pipelines', 'Export History'];

const STAT_CARDS = [
  { label: 'Total Prompts', value: '—' },
  { label: 'Favorites', value: '—' },
  { label: 'Tags Used', value: '—' },
  { label: 'Notebooks', value: '—' },
];

const QUICK_ACTIONS = [
  { label: 'New Prompt', sub: 'Save a reusable prompt' },
  { label: 'Import Chat', sub: 'Save a conversation' },
  { label: 'Add Source', sub: 'Send page to NotebookLM' },
  { label: 'Take Screenshot', sub: 'Annotate and send to AI' },
];

export default function DashboardPreview() {
  return (
    <div className="dashboard-app" aria-hidden="true" style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-avatar">n</div>
          <div className="sidebar__brand-info">
            <span className="sidebar__brand-name">Notehublm</span>
            <span className="sidebar__brand-subtitle">Dashboard</span>
          </div>
        </div>

        <div className="sidebar__search-wrap">
          <div className="sidebar__search-btn">
            <span>Search everything…</span>
            <kbd>⌘K</kbd>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((label) => (
            <div key={label} className="sidebar__nav-item">
              <span className="sidebar__nav-icon" />
              <span className="sidebar__nav-label">{label}</span>
            </div>
          ))}

          {GROUP_LABELS.map((label) => (
            <div key={label} className="sidebar__group">
              <div className="sidebar__group-trigger">
                <span>{label}</span>
              </div>
            </div>
          ))}

          <div className="sidebar__divider" />

          {SECONDARY.map((label) => (
            <div key={label} className="sidebar__nav-item">
              <span className="sidebar__nav-icon" />
              <span className="sidebar__nav-label">{label}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="dashboard-app__content">
        <main className="dashboard-app__main">
          <div className="dashboard-home">
            <div className="dashboard-home__hero">
              <div>
                <div className="dashboard-home__date">Your workspace</div>
                <h1 className="dashboard-home__heading">Welcome back</h1>
                <p className="dashboard-home__subheading">
                  Your prompts, notes, and AI history — all in one place.
                </p>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {STAT_CARDS.map(({ label, value }) => (
                <div key={label} className="stat-card">
                  <div className="stat-card__header">
                    <span className="stat-card__label">{label}</span>
                  </div>
                  <div className="stat-card__value">{value}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '8px' }}>
              {QUICK_ACTIONS.map(({ label, sub }) => (
                <div key={label} className="dashboard-home__quick-action">
                  <div className="dashboard-home__quick-action-header">
                    <span className="dashboard-home__quick-action-label">{label}</span>
                  </div>
                  <span className="dashboard-home__quick-action-sub">{sub}</span>
                </div>
              ))}
            </div>

            {/* Recent card placeholder */}
            <div className="dashboard-home__recent-card" style={{ marginTop: '8px', minHeight: '120px' }} />
          </div>
        </main>
      </div>
    </div>
  );
}
