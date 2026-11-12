# Edit sessions

**Historical internal-helper reference.** The shutdown save behavior described below is unsafe and is not the standalone plugin's current behavior. Revision Marks never invokes view saves. Since 0.1.3, normal desktop quit waits for native save tasks and guarded metadata commits; unload/mobile background checkpoint only, with recovery after safe startup/foreground return and native persistence. The unchanged Continuum helper has not received this fix. Use README.md for current plugin behavior.

Internal helper loaded by `scripts/startup.mjs` through CodeScript Toolkit. `created` is written by Templater / Recreate default frontmatter. Front Matter Timestamps automatic writes are disabled in its configuration; Frontmatter Date Manager must remain disabled. Restart Obsidian after installation, or reload the Toolkit startup script after ensuring competing automatic writers are off.

## Session boundaries and comparison

- Leaving/closing the active note ends its editing session. Changing between views of the same note does not.
- **Save current file / Ctrl+S** saves the buffer and ends the session. Further input starts a new one; saving unchanged content is a no-op. Autosave alone does not end a session.
- App quit registers an awaited task with Obsidian's `Tasks.add`. Document hiding, page hide, and mobile window blur also request saving and session completion. Duplicate triggers are serialized and do not increment twice.
- Toolkit startup-script cleanup also attempts full session completion, rather than only checkpointing, if it is reached without a preceding quit event. A reload/unload is therefore another session boundary. A process kill can still prevent asynchronous completion.
- Compare parsed frontmatter and complete body with the initial content, ignoring only `updated`, `updated_count`, YAML property order, and line-ending convention. Other properties, including `created`, are relevant; the helper does not generate or overwrite `created`. Body whitespace is meaningful. Complete undo means no write.
- A completed changed session sets `updated` from the saved file's local `mtime` before our metadata write (last input time is a fallback if no mtime is available) and increases `updated_count` once. Obsidian's `processFrontMatter` preserves other property values, but can reformat their YAML representation.
- Only advance `updated` if its valid current instant is older than the proposed formatted mtime. Equal or newer dates retain their existing value and timezone spelling; a counter increment can still occur. Missing/invalid timestamps are filled/repaired. Sub-second differences below the configured timestamp precision do not cause timestamp replacement.
- If `updated` or `updated_count` is missing, insert it and apply the existing Templater helper `ensureFmPropertyOrder.js` using `frontmatter_order` in `scripts/defines/orders.md`. Unlisted properties retain their relative order after known properties. Updates of two already-present fields do not reorder the whole frontmatter.
- Exclude root folders `archives`, `scripts`, `libraries`, `templates`, `inbound`. Notes at the vault root remain eligible. Folder moves/deletions update/drop descendant sessions and baselines.

## Bases, Properties and external changes

The helper also observes vault create/modify events, so changes from Bases, the Properties sidebar, embedded editors, other plugins and external programs can be detected without a full-note editor transaction.

A device-local baseline contains a SHA-256 fingerprint of semantic content, the two managed fields and the observed mtime. First installation builds these fingerprints in the background without backdating or counting existing notes. Until a previously unseen file has a baseline, its old content is unknown; the first observation only establishes that baseline. Direct editor input supplies its own pre-change document and does not need to wait for indexing.

On subsequent starts, inspect file stats and read only notes with a missing baseline or changed mtime. Initial indexing yields between batches of 16 files and persists in larger batches. No recurring whole-vault content scan runs. The baseline cache is localStorage, not a synced vault file.

Rules for an observed file change:

1. Fingerprint unchanged: no timestamp or counter change, regardless of mtime.
2. Content changed and **either** `updated` **or** `updated_count` already differs: accept the other writer's stamp and do not count again.
3. Content changed and both managed fields unchanged: record a pending session with the file's mtime. Inactive notes are completed immediately; an actively edited note waits for a session boundary.

This is a sync heuristic, not a distributed transaction. A copied mtime is not universally the true human edit time. Concurrent edits from several devices can still conflict or merge counter increments. External edits preserving mtime while Obsidian is closed may not be discovered by the startup stat check. Clearing the baseline cache requires a fresh initial baseline pass, not retrospective reconstruction.

## Recovery and write safety

Pending session fingerprints, original metadata and write intentions are kept in localStorage under `continuum.editSessions.v1:<vault path/name>`; the companion `:baselines` key holds fingerprints of known notes. No note text is stored. These records are neither synced nor committed; do not clear application storage with pending sessions.

Write-ahead intentions distinguish a completed update from one still needing application, preventing double counting after interruption. A pending session is checkpointed after 300 ms of input inactivity and on lifecycle events. A normal quit is awaited; Android may still suspend or kill the process before asynchronous work finishes. Recovery retries on the next launch. If the user starts typing during startup recovery, writing is deferred until the next boundary.

Before writing, save eligible editor buffers, recheck content and metadata, and stop if new input arrives. Divergent views of the same note, dirty or stale buffers, malformed YAML, invalid counters and concurrent changes defer writing with a notice. Never force an older editor buffer over an externally updated note. Unexpected failures preserve the journal. Repeated identical notices are suppressed until reload.

The core **Save current file** command has no public post-save event. The helper wraps its execution callbacks through `app.commands.commands["editor:save-file"]`, preserves availability checks, return values and key bindings, and restores the callbacks on cleanup. An API change preventing registration produces a notice instead of silently claiming Ctrl+S support.

## Focused live checks

1. Restart Obsidian; confirm no Edit sessions error. Allow the first background baseline pass to finish before testing Properties/Bases.
2. Edit a disposable existing note, wait over ten seconds: no metadata write while still active. Press Ctrl+S: one increment and mtime-based `updated`. Continue typing, save again: one more increment. Save unchanged: no increment.
3. Edit and completely undo, then save/leave: neither managed field changes.
4. Change a tag in Properties or a cell in Bases. Metadata-only changes to `updated`/`updated_count` must not recursively count. Bases edits of an inactive note should update immediately; an active note can stay pending until save/leave.
5. Change a known note externally with both managed fields untouched: count once using local mtime. Simulate a synced change already updating either field: no extra increment.
6. Edit, quit and restart: one increment, with no second increment on another restart. Repeat on Android by leaving/backgrounding the activity and reopening it.
7. Check a rename/folder move and two views of the same note. Divergent buffers should defer the metadata update, not overwrite content.

Unit and simulated-runtime tests do not establish actual desktop/mobile rendering, command routing or lifecycle behavior. Excalidraw/Canvas-specific tracking is not implemented; only eligible Markdown files participate.
