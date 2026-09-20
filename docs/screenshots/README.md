# Screenshots

Images referenced by the root [README](../../README.md).

| File | Shows |
| --- | --- |
| `sp-tools.png` | Side panel — tools grid and recent activity |
| `db-home.png` | Dashboard home — capture activity heatmap, stat tiles, quick actions |
| `db-sources.png` | All Sources — aggregated source table with filters |
| `db-notebook.png` | Notebook detail view |
| `db-screenshot.png` | Screenshot editor — background, framing, annotation controls |
| `db-pipelines.png` | Pipelines — automation rules |
| `db-analytics.png` | Analytics |

Prefix convention: `sp-` for side panel, `db-` for dashboard.

## Guidelines for new screenshots

- **Format** — PNG. Use JPG only if a shot exceeds ~500 KB after optimizing.
- **Width** — 1600 px. Retina captures come off the screen at ~3800 px, which is
  pure waste since GitHub scales them down anyway. Downscale before committing:
  ```bash
  sips -Z 1600 docs/screenshots/*.png     # macOS, in place
  ```
  The side-panel shots are the exception — they are already narrow, so leave
  them at native width and size them in the README with a `width` attribute.
- **Size** — keep each file under ~500 KB so clones stay fast.
- **Naming** — `kebab-case.png` with the surface prefix above.
- **Theme** — dark, matching the existing set. Avoid transparent backgrounds;
  GitHub renders README images on both light and dark page backgrounds and a
  transparent shot becomes unreadable on one of them.
- **Redact first** — these are public. Use demo data, and check for a real
  email, avatar, notebook title, or source URL before committing.
