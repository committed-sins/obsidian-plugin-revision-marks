# Requirements and acceptance criteria

## Session boundaries

A session starts with an actual content change and ends when the user leaves/closes the note, explicitly saves, quits Obsidian, or backgrounds/unfocuses the mobile activity. Autosave alone does not end a session. Continuing after an explicit save starts another session. Switching between two views of the same note is not a boundary.

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
