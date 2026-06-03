import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';

// WXT 0.19's defineConfig accepts only a static object, so we resolve the
// active mode (passed via the CLI `--mode <value>` flag) by parsing argv and
// then load the matching `.env.<mode>` file via Vite's loadEnv.
function resolveMode(): 'development' | 'production' {
  const flagIndex = process.argv.indexOf('--mode');
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    const value = process.argv[flagIndex + 1];
    if (value === 'development' || value === 'production') return value;
  }
  // `wxt` (no subcommand) is dev; `wxt build` / `wxt zip` default to prod.
  return process.argv.includes('build') || process.argv.includes('zip')
    ? 'production'
    : 'development';
}

const mode = resolveMode();
const env = loadEnv(mode, process.cwd(), 'VITE_');
const authOrigin = env.VITE_EXTERNAL_AUTH_ORIGIN;
if (!authOrigin) {
  throw new Error(
    `Missing VITE_EXTERNAL_AUTH_ORIGIN in .env.${mode}. ` +
    `Define the auth-page origin (e.g. https://localhost:3000 for dev, ` +
    `https://www.notehublm.com for prod) before building.`,
  );
}

const isDev = mode === 'development';

export default defineConfig({
  srcDir: 'src',
  outDir: isDev ? '.output-dev' : '.output',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: isDev ? 'Notehublm Dev' : 'Notehublm',
    description: 'Enhance your LLM chatbot experience by saving and managing text snippets.',
    version: '1.0.0',
    permissions: ['storage', 'alarms', 'tabs', 'offscreen', 'cookies', 'sidePanel', 'scripting'],
    options_ui: {
      page: 'dashboard.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; " +
        'connect-src https://apis.google.com https://www.gstatic.com ' +
        'https://www.googleapis.com https://securetoken.googleapis.com ' +
        'https://identitytoolkit.googleapis.com https://notebooklm.google.com ' +
        'https://accounts.google.com https://oauth2.googleapis.com ' +
        'https://*.cloudfunctions.net ' +
        `${authOrigin} ` +
        'https://lh3.googleusercontent.com https://lh3.google.com ' +
        'https://*.usercontent.google.com;',
    },
    background: {
      service_worker: 'background.js',
    },
    host_permissions: [
      '<all_urls>',
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
      'https://copilot.microsoft.com/*',
      'https://chat.deepseek.com/*',
      'https://chat.mistral.ai/*',
      'https://grok.com/*',
      'https://notebooklm.google.com/*',
      'https://lh3.googleusercontent.com/*',
      'https://lh3.google.com/*',
      'https://*.usercontent.google.com/*', // Audio CDN redirect target (drum.usercontent.google.com)
      'https://www.googleapis.com/*',      // Drive API
      'https://oauth2.googleapis.com/*',      // Token revocation endpoint
      'https://securetoken.googleapis.com/*', // Firebase token refresh
      'https://*.cloudfunctions.net/*',       // Token proxy Cloud Functions
      'https://identitytoolkit.googleapis.com/*',
      'https://accounts.google.com/*',
      `${authOrigin}/*`,
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
