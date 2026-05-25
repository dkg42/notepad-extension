/**
 * @module SettingsPage
 * @description Renders the dashboard settings panel: profile/auth, table preferences, data import/export, and other configuration.
 * @dependencies useSettingsPage, DomainRouterSettings, @/contexts/NavigationContext, @/services/auth-service
 * @public SettingsPage
 */
import React, { useEffect, useState } from 'react';
import type { StoredAuthProfile } from '@/types';
import type { SortColumn, SortDirection } from '@/types/dashboard';
import { authService } from '@/services/auth-service';
import { isAuthCancellation, getFriendlyAuthError } from '@/utils/auth-errors';
import { useNavigation } from '@/contexts/NavigationContext';
import './SettingsPage.css';

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function useCurrentUser() {
  const [user, setUser] = useState<StoredAuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authService.getCurrentUser().then((u) => { setUser(u); setLoading(false); });
    const unsub = authService.onAuthStateChange((u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);
  return { user, loading };
}

const ROWS_OPTIONS = [10, 25, 50, 100];
const SORT_COLUMNS: Array<{ value: SortColumn; label: string }> = [
  { value: 'savedAt', label: 'Date Saved' },
  { value: 'text', label: 'Prompt Text' },
  { value: 'source', label: 'Source' },
  { value: 'folder', label: 'Folder' },
];

export default function SettingsPage() {
  const { settings, handleSettingsChange: onSettingsChange } = useNavigation();
  const { user, loading: userLoading } = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await authService.signOut(); } finally { setSigningOut(false); }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await authService.signIn();
      if (!res.ok && !isAuthCancellation(res.error)) {
        setAuthError(getFriendlyAuthError(res.error ?? ''));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!isAuthCancellation(msg)) {
        setAuthError(getFriendlyAuthError(msg));
      }
    } finally {
      setSigningIn(false);
    }
  };
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__heading">Settings</h1>
        <p className="settings-page__subheading">Customise the dashboard experience.</p>
      </div>

      <div className="settings-page__sections">
        {/* Profile */}
        <section className="settings-section">
          <h2 className="settings-section__title">Profile</h2>
          {userLoading ? (
            <div className="settings-row">
              <span className="settings-row__name" style={{ color: 'var(--color-text-secondary)' }}>Loading…</span>
            </div>
          ) : user ? (
            <>
              <div className="settings-row settings-page__profile-row">
                <div className="settings-page__avatar">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName ?? ''} className="settings-page__avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="settings-page__avatar-initials">{getInitials(user.displayName)}</span>
                  )}
                </div>
                <div className="settings-row__label">
                  {user.displayName && <span className="settings-row__name">{user.displayName}</span>}
                  {user.email && <span className="settings-row__description">{user.email}</span>}
                </div>
                <button
                  className="settings-page__btn settings-page__btn--danger"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </>
          ) : (
            <div className="settings-row">
              <div className="settings-row__label">
                <span className="settings-row__name">Not signed in</span>
                <span className="settings-row__description">Sign in to sync your data across devices.</span>
              </div>
              <button className="settings-page__btn" onClick={handleSignIn} disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
              {authError && <p className="settings-page__error" style={{ padding: 0 }}>{authError}</p>}
            </div>
          )}
        </section>

        {/* Table Defaults */}
        <section className="settings-section">
          <h2 className="settings-section__title">Table Defaults</h2>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Rows per page</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.rowsPerPage}
              onChange={(e) => void onSettingsChange({ rowsPerPage: Number(e.target.value) })}
            >
              {ROWS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Default sort column</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.defaultSortColumn}
              onChange={(e) =>
                void onSettingsChange({ defaultSortColumn: e.target.value as SortColumn })
              }
            >
              {SORT_COLUMNS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <span className="settings-row__name">Default sort direction</span>
            </div>
            <select
              className="settings-page__select"
              value={settings.defaultSortDirection}
              onChange={(e) =>
                void onSettingsChange({ defaultSortDirection: e.target.value as SortDirection })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h2 className="settings-section__title">About</h2>
          <div className="settings-page__about">
            <p>
              <strong>Notehublm</strong> — v1.0.0
            </p>
            <p>Save prompts from ChatGPT, Claude, Gemini, Perplexity and more.</p>
            <p className="settings-page__shortcuts-hint">
              Press <kbd>?</kbd> anywhere in the dashboard for keyboard shortcuts.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
