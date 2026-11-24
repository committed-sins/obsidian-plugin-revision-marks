# Requirements and acceptance criteria

## Session boundaries

A session starts with an actual content change and ends when the user leaves/closes the note, switches from editing to reading view, explicitly saves, quits Obsidian, or backgrounds/unfocuses the mobile activity. Autosave alone does not end a session. Continuing after an explicit save starts another session. Switching between two views of the same note is not a boundary. Keep the session open while another source editor for that active note remains open. Properties can still be edited in reading view; native saved changes there may complete without waiting for the note to be left.

Since 0.1.3, normal desktop quit checkpoints pending work, waits for Obsidian's registered native saves, then completes guarded metadata commits before exit. Capture the existing quit-task aggregate before adding our task, and permit writes only for that dedicated completion. Never call a view's save method. Plugin unload, mobile backgrounding, missing task support and unsafe/failed saves retain recovery work for the next safe startup or foreground return. Completion commands retain unsaved sessions until native persistence finishes.

## Content and metadata

Compare parsed frontmatter and the complete note body. Ignore only the two configured managed properties, frontmatter key order and line-ending convention. Preserve body whitespace as meaningful. A complete undo and metadata-only edits to the managed properties must produce no timestamp/counter write.

Default output is `created`, `updated` and one `revision` increment, with all three names configurable. Use the saved file's local mtime before our own metadata write. Fill an absent creation property with the final updated value; preserve existing creation values. Invalid YAML or counters must fail without destructive rewriting.

When a session key is missing, insert a contiguous creation/update/revision block at the first existing session key, or at the end if none exist. Preserve unrelated properties' relative order. Once all three exist, preserve their exact positions and any manual arrangement.

## Input sources

Support full Markdown editor input, Bases, the Properties editor and external file changes. Exclusions must be configurable; the vault root may remain eligible.

For external changes, require a known content baseline. If content changed while both managed fields remained unchanged, schedule an update using local mtime. If either field already changed, accept the incoming stamp without a second increment. The first observation of an unknown file establishes a baseline rather than inventing a historical edit.

## Reliability

- Write timestamp and counter together, once per changed completed session.
- Persist a write intention before the metadata commit and recognize completed intentions after restart.
- Do not overwrite divergent, dirty or stale editor buffers.
- Recheck for edits arriving during completion.
- Await native saves and safe metadata completion on normal desktop quit; retain the journal checkpoint and recovery for interruptions.
- Treat Android backgrounding as best effort, not a guarantee against immediate process termination.
- Do not claim atomic multi-device counters or that copied filesystem timestamps always represent human edit time.

## Initial non-goals

No revision-content history, remote service, analytics, replacement of an existing creation value, automatic property renaming, encryption, Excalidraw/Canvas-specific integration, or arbitrary command execution from note content. Additional completion actions need a separate design.

## Revision options

- Count the renamed file itself only when `countRenames` is enabled (default true).
- Do not count automatic link updates in other notes by default; update their timestamp only. With `countLinkUpdates` disabled, accept only link-only changes attributable to a known rename or move, including folder moves. Additional content/property edits, unknown baselines, stale or unsupported metadata and expired rename context remain conservative: never silently discard a meaningful edit.
- A confirmed pure link rewrite creates a journaled timestamp-only session. It updates timestamps without changing or inserting a counter, including after restart or duplicate observations. A genuine content edit joining that session upgrades it to normal counting. Rename context is transient; if it is lost on interruption, recovery may count the change normally.
- Initialize a missing revision property to `initialRevision` (default 0), a non-negative safe integer below the maximum safe value. This also applies to existing notes missing the property. Existing counter values always advance by one; changing the setting does not reset counters or bulk-stamp notes. An interrupted initial write of zero must distinguish absent revision from a successfully inserted zero.

## New-note initialization

A native vault create event marks a new note for counter initialization at the next safe completion boundary. Startup scans and first observations of existing files do not initialize counters. An unchanged new note receives the configured initial value (default 0); a subsequent actual content change or counted rename advances it by one, including before the initial metadata write. Existing preset counters remain untouched on creation. Duplicate native events and recovery retain the initialization decision without resetting or double-counting. Unrendered template headers remain deferred until valid content becomes available; no write is made into active typing buffers.
