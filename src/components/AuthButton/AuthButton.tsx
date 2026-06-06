/**
 * @module AuthButton
 * @description Renders a full-screen sign-in gate that triggers the Firebase authentication flow via the background service worker; displays loading and error states during sign-in.
 * @dependencies authService (@/services/auth-service)
 * @public AuthButton
 */
import React, { useState } from 'react';
import { authService } from '@/services/auth-service';
import { isAuthCancellation, getFriendlyAuthError } from '@/utils/auth-errors';
import { logger } from '@/utils/logger';
import './AuthButton.css';

interface Props {
  onSignIn?: () => void;
  onError?: (error: string) => void;
}

/**
 * Full-screen sign-in gate shown when the user is not authenticated.
 * Triggers the background → offscreen → Firebase sign-in flow on click.
 */
export default function AuthButton({ onSignIn, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    logger.debug('[AUTH][AuthButton] Sign-in button clicked');
    setLoading(true);
    setError(null);
    try {
      logger.debug('[AUTH][AuthButton] Calling authService.signIn()...');
      const response = await authService.signIn();
      logger.debug('[AUTH][AuthButton] authService.signIn() resolved:', response);
      if (response.ok) {
        logger.debug('[AUTH][AuthButton] Sign-in successful, calling onSignIn callback');
        onSignIn?.();
      } else {
        const msg = response.error ?? 'Sign-in failed';
        if (isAuthCancellation(msg)) {
          logger.info('[AUTH][AuthButton] sign-in cancelled by user');
        } else {
          console.error('[AUTH][AuthButton] Sign-in failed:', msg);
          setError(getFriendlyAuthError(msg));
          onError?.(msg);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      if (isAuthCancellation(msg)) {
        logger.info('[AUTH][AuthButton] sign-in cancelled by user');
      } else {
        console.error('[AUTH][AuthButton] Unexpected error:', err);
        setError(getFriendlyAuthError(msg));
        onError?.(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-button-container">
      <div className="auth-button-card">
        <h2 className="auth-button-title">Sign in to continue</h2>
        <p className="auth-button-subtitle">Use your Google account</p>
        <button
          className="auth-button-google"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <span className="auth-button-spinner" aria-label="Signing in..." />
          ) : (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          )}
        </button>
        {error && <p className="auth-button-error">{error}</p>}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="auth-button-google-icon"
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
