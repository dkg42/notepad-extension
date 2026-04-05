import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LLM Chat Enhancer',
    description: 'Enhance your LLM chatbot experience by saving and managing text snippets.',
    version: '1.0.0',
    permissions: ['storage', 'alarms', 'tabs', 'offscreen', 'cookies'],
    optional_host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'dashboard.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://securetoken.googleapis.com https://notebooklm.google.com https://accounts.google.com;",
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
      // 'https://www.googleapis.com/*', // Uncomment when Google Docs sync is enabled
      'https://securetoken.googleapis.com/*', // Firebase token refresh
      'https://identitytoolkit.googleapis.com/*',
      'https://accounts.google.com/*',
      'https://localhost:3000/*'
    ],
    // ── Future: Google Docs sync ──────────────────────────────────────────────
    // Uncomment and fill in client_id when enabling direct Google Drive sync.
    // See background.ts for the identity message handler.
    //
    // permissions: ['storage', 'identity'],
    // oauth2: {
    //   client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
    //   scopes: ['https://www.googleapis.com/auth/drive.file'],
    // },
    // ─────────────────────────────────────────────────────────────────────────
  },
});
