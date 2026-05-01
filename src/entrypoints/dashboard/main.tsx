/**
 * @module main
 * @description Dashboard entrypoint that imports global design tokens and mounts the DashboardApp React tree into the #root DOM node using React 18 concurrent mode.
 * @dependencies DashboardApp (./DashboardApp/DashboardApp), @/styles/tokens.css
 * @public none
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/tokens.css';
import DashboardApp from './DashboardApp/DashboardApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
