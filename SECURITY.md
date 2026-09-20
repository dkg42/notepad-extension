# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report privately through **GitHub Security Advisories** —
[open a draft advisory](https://github.com/dkg42/notepad-extension/security/advisories/new).
This keeps the discussion private until a fix ships and lets us credit you in
the published advisory.

Please include:

- The type of issue and which component it affects
- Steps to reproduce, or a proof of concept
- The extension version and browser version
- What an attacker could achieve with it

### What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement of your report | within 3 business days |
| Initial assessment and severity | within 7 business days |
| Fix released for critical issues | as fast as a Chrome Web Store review allows |

You will be credited in the advisory unless you prefer otherwise. Please give us
a reasonable window to ship a fix before public disclosure.

## Supported versions

Only the latest release published to the Chrome Web Store receives security
fixes. Local builds from this repository are unsupported.

## Scope

**In scope**

- The extension source in this repository
- Privilege escalation via content scripts or the message-passing surface
- Leakage of user notebook content, snippets, or OAuth tokens
- Auth or session-handling flaws in the sign-in flow
- Anything that lets a visited web page reach extension-privileged APIs

**Out of scope**

- The Cloud Functions backend and the hosted auth page (not in this repository —
  still report those via a draft advisory here, but note they are separate
  deployments and fixes ship on their own schedule)
- Vulnerabilities in NotebookLM, Google Drive, or the supported chat sites
  themselves — report those to their respective vendors
- Findings that require a compromised device, a malicious extension already
  installed, or physical access
- Missing hardening headers with no demonstrated impact
- Automated scanner output without a working proof of concept

## Notes for reviewers

A few design points that often come up in audits:

- **`VITE_FIREBASE_API_KEY` is not a secret.** Firebase Web API keys are public
  client identifiers, [by Google's design](https://firebase.google.com/docs/projects/api-keys).
  Access is controlled by Firebase Security Rules and API key restrictions, not
  by keeping the key hidden. Finding it in a build artifact is expected.
- **The Dodo Payments API key never reaches the client.** Billing runs through
  Callable Cloud Functions that hold the key server-side; the extension only
  receives time-bound portal URLs.
- **`<all_urls>` is required** for selection capture and the capture strip, which
  must run on whatever page the user chooses to save from.
- **Drive access uses `drive.appdata`**, an app-private folder scope. The
  extension cannot read the rest of the user's Drive.
- **NotebookLM access uses the user's own signed-in session** against the
  internal `batchexecute` endpoint. No credentials are proxied or stored
  server-side.

If you find something that contradicts any of the above, that is exactly the
kind of report we want.
