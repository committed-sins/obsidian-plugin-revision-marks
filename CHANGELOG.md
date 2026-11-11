# Changelog

## 0.1.2

- Fix a data-loss path in 0.1.0/0.1.1: plugin-initiated `view.save()` could write an already-cleared view mode over a saved note during shutdown. Never invoke view saves from the plugin.
- Checkpoint metadata work only during quit, unload and mobile backgrounding; recover it after safe startup or foreground return. This deliberately defers exit-time metadata writes.
- Await existing native saves, validate both view-mode and editor content, retain unsaved sessions, and cancel queued writes as soon as teardown starts.
- Add synthetic regressions reproducing the empty-note failure and covering shutdown races, native save promises, restart idempotence and foreground recovery. Real desktop/mobile validation is still pending.

## 0.1.1

- Configure the creation, update and revision property names; use `revision` as the new default counter name.
- Fill an absent creation property with the final updated timestamp when a changed session completes.
- Complete missing session fields as a contiguous creation/update/revision block beside existing session fields, or append the block if none exist.
- Preserve complete manually arranged blocks and unrelated property order; remove global frontmatter sorting.
- Scope recovery by property names, preserve previous-preview state and avoid counting creation-field insertion twice after an interrupted commit.

## 0.1.0

- Extract the current Continuum session helper into a standalone development preview without CodeScript Toolkit or Templater dependencies.
- Add settings, completion commands, build/tests and targeted test-vault deployment.
