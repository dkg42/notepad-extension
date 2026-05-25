/**
 * @module auth-errors
 * @description Shared helpers for classifying auth error strings produced anywhere along the sign-in chain (GIS error_callback → iframe page → offscreen → background → UI). Lets every layer agree on what counts as a user-cancellation (no log, no banner) vs a real failure.
 * @dependencies none
 * @public isAuthCancellation, getFriendlyAuthError
 */

/** Returns true when an auth error string represents the user closing/dismissing the popup. */
export function isAuthCancellation(error: string | undefined | null): boolean {
  if (!error) return false;
  return error.includes('popup-closed-by-user')
      || error.includes('popup_closed')
      || error.includes('cancelled-popup-request');
}

/** Maps a raw auth error code/message to a short user-facing message. */
export function getFriendlyAuthError(raw: string): string {
  if (isAuthCancellation(raw)) {
    return 'Sign-in was cancelled.';
  }
  if (raw.includes('network-request-failed')) {
    return 'Network error. Try again.';
  }
  if (raw.includes('too-many-requests')) {
    return 'Too many attempts. Try again later.';
  }
  if (raw.includes('operation-not-allowed')) {
    return 'Sign-in not configured.';
  }
  return 'Sign-in failed. Please try again.';
}
