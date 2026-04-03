import React, { useEffect, useRef, useState } from 'react';
import type { UserCredential } from 'firebase/auth/web-extension';
import { authService } from '@/services/auth-service';
import './AccountSwitcher.css';

interface Props {
  user: UserCredential | null;
  onSignOut?: () => void;
}

/**
 * Compact user identity widget for the popup header.
 * - Signed in: avatar + name trigger opens a dropdown profile card with sign-out.
 * - Signed out: compact "Sign in" button that triggers the auth flow.
 */
export default function AccountSwitcher({ user, onSignOut }: Props) {
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authService.signOut();
      setIsOpen(false);
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

  const { displayName, email, photoURL } = user.user;
  const initials = getInitials(displayName ?? email ?? '?');

  return (
    <div className="account-switcher" ref={containerRef}>
      <button
        className="account-switcher__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={displayName ?? email ?? ''}
      >
        <div className="account-switcher__avatar">
          {photoURL ? (
            <img
              src={photoURL}
              alt={displayName ?? 'User avatar'}
              className="account-switcher__avatar-img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-switcher__avatar-initials">{initials}</span>
          )}
        </div>
        <span className="account-switcher__name">{displayName ?? email ?? 'Signed in'}</span>
      </button>

      {isOpen && (
        <div className="account-switcher__dropdown" role="dialog" aria-label="Account">
          <div className="account-switcher__dropdown-profile">
            <div className="account-switcher__dropdown-avatar">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName ?? 'User avatar'}
                  className="account-switcher__avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="account-switcher__dropdown-initials">{initials}</span>
              )}
            </div>
            {displayName && (
              <span className="account-switcher__dropdown-name">{displayName}</span>
            )}
            {email && (
              <span className="account-switcher__dropdown-email">{email}</span>
            )}
          </div>

          <div className="account-switcher__dropdown-actions">
            <button
              className="account-switcher__signout-btn"
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
