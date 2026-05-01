/**
 * @module AccountPage
 * @description Dashboard account management page — shows a Google sign-in card when unauthenticated or a profile card with sign-out and a one-time local-data migration banner when signed in.
 * @dependencies @/types, @/services/auth-service
 * @public AccountPage
 */
import React, { useEffect, useState } from 'react';
import type { StoredAuthProfile } from '@/types';
import { authService } from '@/services/auth-service';
import './AccountPage.css';

function GoogleIcon() {
  return (
    <svg
      className="account-page__google-icon"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getFriendlyAuthError(raw: string): string {
  if (raw.includes('popup-closed-by-user') || raw.includes('cancelled-popup-request')) {
    return 'Sign-in was cancelled. Please try again.';
  }
  if (raw.includes('network-request-failed')) {
    return 'Network error. Check your connection and try again.';
  }
  if (raw.includes('too-many-requests')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  if (raw.includes('operation-not-allowed')) {
    return 'Google sign-in is not enabled. Please contact support.';
  }
  if (raw.includes('user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }
  return 'Sign-in failed. Please try again.';
}

/**
 * Dashboard account management page.
 * - Unauthenticated: shows Google sign-in card with a note that local data is safe.
 * - Authenticated: shows profile card with user details, sign-out, and a one-time
 *   migration confirmation banner when pre-sign-in data has been attributed.
 */
export default function AccountPage() {
  const [user, setUser] = useState<StoredAuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      setIsLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange((u) => {
      setUser(u);
      setIsLoading(false);
    });

    // Listen for the migration event broadcast by the background worker
    const handleMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: string }).type === 'local-data-migrated'
      ) {
        setShowMigrationBanner(true);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      unsubscribe();
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const response = await authService.signIn();
      if (!response.ok) {
        setSignInError(getFriendlyAuthError(response.error ?? ''));
      }
    } catch (err) {
      setSignInError(getFriendlyAuthError(err instanceof Error ? err.message : ''));
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authService.signOut();
      setShowMigrationBanner(false);
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading) {
    return <div className="account-page__loading">Loading…</div>;
  }

  return (
    <div className="account-page">
      <div className="account-page__header">
        <h1 className="account-page__title">Account</h1>
        <p className="account-page__subtitle">
          Sign in to unlock sync and premium features in the future.
        </p>
      </div>

      {!user ? (
        <div className="account-page__card">
          <div className="account-page__signin-section">
            <p className="account-page__signin-note">
              All your saved prompts, notebooks, and settings are stored locally and will remain
              intact after signing in.
            </p>
            <button
              className="account-page__google-btn"
              onClick={handleSignIn}
              disabled={signingIn}
            >
              {signingIn ? (
                <span className="account-page__spinner" aria-label="Signing in…" />
              ) : (
                <>
                  <GoogleIcon />
                  Sign in with Google
                </>
              )}
            </button>
            {signInError && <p className="account-page__error">{signInError}</p>}
          </div>
        </div>
      ) : (
        <div className="account-page__card">
          {showMigrationBanner && (
            <div className="account-page__migration-banner">
              Your local data has been linked to this account and will sync when cloud features
              are enabled.
              <button
                className="account-page__migration-close"
                onClick={() => setShowMigrationBanner(false)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <div className="account-page__profile">
            {(() => {
              const { displayName = null, email = null, photoURL = null } = user ?? {};
              return (
                <>
                  <div className="account-page__avatar">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt={displayName ?? 'User avatar'}
                        className="account-page__avatar-img"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="account-page__avatar-initials">
                        {getInitials(displayName ?? email ?? '?')}
                      </span>
                    )}
                  </div>
                  <div className="account-page__profile-info">
                    {displayName && (
                      <span className="account-page__display-name">{displayName}</span>
                    )}
                    {email && (
                      <span className="account-page__email">{email}</span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="account-page__actions">
            <button
              className="account-page__signout-btn"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
