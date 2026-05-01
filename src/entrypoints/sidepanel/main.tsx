/**
 * @module main
 * @description Side panel entrypoint that mounts the React application tree into the #root DOM node using React 18 concurrent mode.
 * @dependencies App (./App/App)
 * @public none
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
