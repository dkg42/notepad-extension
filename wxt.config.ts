import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LLM Chat Enhancer',
    description: 'Enhance your LLM chatbot experience by saving and managing text snippets.',
    version: '1.0.0',
    permissions: ['storage', 'alarms', 'tabs', 'offscreen', 'cookies', 'sidePanel'],
    optional_host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'dashboard.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://securetoken.googleapis.com https://notebooklm.google.com https://accounts.google.com https://oauth2.googleapis.com;",
    },
    background: {
      service_worker: "background.js"
    },
    host_permissions: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
      'https://copilot.microsoft.com/*',
      'https://notebooklm.google.com/*',
      'https://lh3.googleusercontent.com/*',
      'https://lh3.google.com/*',
      'https://*.usercontent.google.com/*', // Audio CDN redirect target (drum.usercontent.google.com)
      'https://www.googleapis.com/*',      // Drive API
      'https://oauth2.googleapis.com/*',   // Token refresh and revocation endpoints
      'https://securetoken.googleapis.com/*', // Firebase token refresh
      'https://identitytoolkit.googleapis.com/*',
      'https://accounts.google.com/*',
      'https://localhost:3000/*'
    ],
    // ── Google Drive AppData sync ─────────────────────────────────────────────
    // drive.appdata: app-private storage invisible to the user (AppData folder).
    // drive.file: kept for future Google Docs export feature.
    // These scopes are requested at sign-in time via the Firebase/OAuth2 flow
    // in offscreen.ts — they are documented here for reference only.
    //
    // Requested scopes:
    //   https://www.googleapis.com/auth/drive.appdata
    //   https://www.googleapis.com/auth/drive.file  (reserved for Docs export)
    // ─────────────────────────────────────────────────────────────────────────
  },
});
