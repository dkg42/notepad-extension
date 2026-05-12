/**
 * @module main
 * @description Dashboard entrypoint that imports global design tokens and mounts the DashboardApp React tree into the #root DOM node using React 18 concurrent mode.
 * @dependencies DashboardApp (./DashboardApp/DashboardApp), @/styles/tokens.css
 * @public none
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/tokens.css';
import DashboardApp from './DashboardApp/DashboardApp';
import AuthButton from '@/components/AuthButton/AuthButton';
import { authService } from '@/services/auth-service';
import type { StoredAuthProfile } from '@/types';

function DashboardAuthGate() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [user, setUser] = useState<StoredAuthProfile | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      setIsLoadingAuth(false);
    });

    const unsubscribe = authService.onAuthStateChange((u) => {
      setUser(u);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (isLoadingAuth) {
    return (
      <div className="auth-button-container" aria-label="Loading…" />
    );
  }

  return (
    <>
      <DashboardApp />
      {!user && <AuthButton />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardAuthGate />
  </React.StrictMode>,
);
