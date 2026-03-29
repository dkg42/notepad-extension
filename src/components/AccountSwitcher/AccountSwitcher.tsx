import React, { useState } from 'react';
import type { AuthUser } from '@/types';
import { authService } from '@/services/auth-service';
import './AccountSwitcher.css';

interface Props {
  user: AuthUser | null;
  onSignOut?: () => void;
}

/**
 * Compact user identity widget for the popup header.
 * - Signed in: shows avatar, display name, and a sign-out button.
 * - Signed out: shows a compact "Sign in" button that triggers the auth flow.
 */
export default function AccountSwitcher({ user, onSignOut }: Props) {
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authService.signOut();
      onSignOut?.();
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const response = await authService.signIn();
      if (!response.ok) {
        setSignInError(response.error ?? 'Sign-in failed');
      }
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  };

  if (!user) {
    return (
      <div className="account-switcher account-switcher--guest">
        <button
          className="account-switcher__signin-btn"
          onClick={handleSignIn}
          disabled={signingIn}
          title={signInError ?? 'Sign in with Google'}
        >
          {signingIn ? '...' : 'Sign in'}
        </button>
      </div>
    );
  }

  const initials = getInitials(user.displayName ?? user.email ?? '?');

  return (
    <div className="account-switcher">
      <div
        className="account-switcher__avatar"
        title={user.displayName ?? user.email ?? ''}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? 'User avatar'}
            className="account-switcher__avatar-img"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="account-switcher__avatar-initials">{initials}</span>
        )}
      </div>
      <span className="account-switcher__name" title={user.email ?? ''}>
        {user.displayName ?? user.email ?? 'Signed in'}
      </span>
      <button
        className="account-switcher__signout-btn"
        onClick={handleSignOut}
        disabled={signingOut}
        title="Sign out"
      >
        {signingOut ? '...' : 'Sign out'}
      </button>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
