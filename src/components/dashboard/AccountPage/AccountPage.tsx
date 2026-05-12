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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AccountPage() {
  const [user, setUser] = useState<StoredAuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      setIsLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange((u) => {
      setUser(u);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authService.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading) {
    return <div className="account-page__loading">Loading…</div>;
  }

  if (isLoading || !user) {
    return <div className="account-page__loading">Loading…</div>;
  }

  const { displayName = null, email = null, photoURL = null } = user;

  return (
    <div className="account-page">
      <div className="account-page__header">
        <h1 className="account-page__title">Account</h1>
      </div>

      <div className="account-page__card">
        <div className="account-page__profile">
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
    </div>
  );
}
