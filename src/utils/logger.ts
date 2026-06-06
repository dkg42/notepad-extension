/**
 * Lightweight logger used across all extension contexts (background, content,
 * offscreen, popup). `debug`/`info` are stripped in production builds so the
 * shipped extension does not spam the user's console; `warn`/`error` always log
 * because they carry real diagnostic value when something goes wrong.
 *
 * `import.meta.env.DEV` is replaced at build time by Vite/WXT, so it is `true`
 * only under `npm run dev` (HMR dev server) and `false` for `npm run build`.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
