## What changed

<!-- One or two sentences on the user-visible effect. -->

## Why

<!-- The problem this solves, or a link to the issue it closes. -->

## How I verified it

<!-- Which flows you actually clicked through. There is no test suite yet, so
     this section matters. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Loaded the built extension and exercised the changed flow

## Screenshots

<!-- Required for any UI change. -->

## Checklist

- [ ] Component files follow the folder convention (`.tsx` + `.css` per component)
- [ ] No direct `chrome.storage.*` calls outside `src/services/storage/`
- [ ] Styling uses tokens from `src/styles/tokens.css`, no hard-coded colors
- [ ] New config values added to `.env.example` and the README table
- [ ] No credentials, tokens, or filled-in env files committed
- [ ] Unstable work is gated behind a flag in `src/config/feature-flags.ts`

<!-- Flag it here if this touches auth, billing, storage schemas, or Drive sync. -->
