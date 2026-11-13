# Development and compatibility

Requires Node.js 22 or newer. Run `npm ci`, then `npm run check` to validate formatting, build and run the synthetic test suite. `npm run format` applies the pinned dprint rules: Allman braces for functions/methods/classes, four spaces, single quotes and CRLF. Control-flow blocks keep same-line braces; Markdown keeps LF. See [architecture](architecture.md) for module responsibilities.

## Local deployment

Copy `.env.example` to the ignored `.env.local`, set `OBSIDIAN_VAULT`, then run `npm run deploy`. Explicit environment variables override the local file. Deployment copies only `dist/main.js`, `dist/manifest.json` and `dist/styles.css`; it preserves settings, notes, workspace and activation. Reload the plugin manually after deploying. Deployment does not publish a release.

## Persistence

- Synced settings live in `.obsidian/plugins/revision-marks/data.json` through Obsidian's `loadData()` / `saveData()`.
- Device-local fingerprints and write intentions use `revision-marks.v2:<vault identity>:<property mapping>` and its `:baselines` companion in localStorage. Timestamp-only mode uses a separate `:off` suffix.
- The journal contains fingerprints and metadata, not note text. It is not a backup of unsaved content. Do not clear application storage with pending sessions.
- First installation establishes baselines in paced background batches without stamping existing notes. Later starts read only notes with missing baselines or changed file modification times.

## Previous installations

Formerly Session Marks (`session-marks`). Move an existing plugin folder to `revision-marks` before deploying, preserving `data.json`; update activation/hotkey references without enabling both identities. The plugin copies matching `session-marks.v2:` journals and baselines once, retaining originals and existing new-name state.

The original plugin's v1 journal is compatible only with `created` / `updated` / `updated_count`. Pending sessions block a switch to incompatible names. Internal Continuum/CodeScript Toolkit journals are not imported automatically. Replacing that helper requires a separate handover; never run both writers together.

## Lifecycle limits

Desktop quit waits for already-registered native save tasks, then attempts guarded metadata commits. It captures those tasks before registering its own task, avoiding a self-wait. Unsafe views and failed native saves retain recovery work. Unload/mobile background checkpoint only, with completion after safe startup or foreground return. Mobile process termination may interrupt checkpointing.

The native save-command wrapper uses an internal Obsidian command because no public post-save event is available. Incoming changes with an already-modified timestamp or counter are not counted again; this is a heuristic, not an atomic multi-device counter. External changes preserving mtime may escape the startup check. These boundaries need live desktop and Android testing.

Versions 0.1.0 and 0.1.1 had an unsafe shutdown save path. Do not use them. Current code never invokes a view's save method.
