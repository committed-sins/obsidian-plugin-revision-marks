# Changelog

## 0.1.5

- Add a Revision tracking dropdown with Off and Counter; Counter remains the default for existing and new installations.
- Off keeps content-aware creation/update timestamps without adding, validating or changing a revision value. Existing revision fields become ordinary content and retain their placement.
- Isolate timestamp-only recovery state and refuse mode changes while previous sessions remain pending. Preserve interrupted-commit recovery and the existing shutdown safeguards.

## 0.1.4

- Rename the plugin to Revision Marks, with plugin ID `revision-marks` and repository `obsidian-plugin-revision-marks`.
- Copy property-mapped device-local journals and baselines from the former `session-marks` namespace on first use, retaining originals and existing new-name state.
- Preserve settings and activation when renaming an existing test-vault installation; do not run old and new plugin IDs together.

## 0.1.3

- On normal desktop quit, await Obsidian's already-registered save tasks, then finish guarded timestamp/revision writes before allowing exit. Never invoke another view save.
- Capture prior quit tasks before registering our own, isolate shutdown write permission from ordinary queued work, and join duplicate quit events without another increment.
- Keep checkpoint/recovery fallback for mobile, missing task support, failed native saves, detached views and plugin unload.
- Cover delayed native and metadata persistence, native failure, unload cancellation, multiple notes/Properties, and restart idempotence with synthetic quit-task tests. Live desktop/mobile validation remains pending.

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
