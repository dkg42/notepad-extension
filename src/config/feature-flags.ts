/**
 * Central build-time feature toggles. Gate unfinished or unstable features here
 * so they can ship dark until ready. Each flag defaults OFF and can be enabled
 * per build profile via its `VITE_ENABLE_*` env var (see `.env.example`).
 *
 * Usage:  if (isFeatureEnabled('geminiNano')) { … }
 */

/** Parse a `VITE_ENABLE_*` env string into a boolean, falling back when unset. */
function envFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const featureFlags = {
  /**
   * On-device Gemini Nano (Chrome Prompt API): powers "Enhance with AI" in
   * Prompt Hub and "Generate AI summary" in Tab Manager. Gated off until the
   * required browser setup is stable.
   */
  geminiNano: envFlag(import.meta.env.VITE_ENABLE_GEMINI_NANO as string | undefined, false),
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
