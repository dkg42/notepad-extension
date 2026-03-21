import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/tokens.css';
import DashboardApp from './DashboardApp/DashboardApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
