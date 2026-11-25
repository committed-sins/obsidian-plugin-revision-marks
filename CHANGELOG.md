# Changelog

## 0.1.11

- Explicitly protect hidden/system paths and the configured Obsidian configuration directory, independently of user exclusions.
- Support `**/folder/` exclusions at any depth, including the vault root. Plain folder paths remain rooted at the vault root; every folder rule includes its descendants.
- During one-time setup, add only the configured attachment-folder rule if missing: a fixed path remains rooted, while `./_assets` becomes `**/_assets`. Root/same-as-note locations add nothing. Preserve user rules, deduplicate equivalent normalized entries and respect subsequent deliberate removals; retry setup if configuration is temporarily unavailable.
- Keep tracking strictly limited to `.md` files.
- Use neutral release, settings and manifest text, and rename the manual testing guide.
- Validate formatting, build and all 113 automated tests, including folder boundaries, attachment-location modes, setup persistence and non-Markdown files.

## 0.1.10

- Complete saved, changed sessions when switching from editing to reading view. Properties edits in reading view are still tracked; an open source view of the same active note keeps the session open.
- Start newly created notes at revision 0 by default. The first subsequent content edit becomes 1, including edits before the initial metadata write. Initialize only at safe session boundaries; preserve existing counters and allow a custom starting value.
- Count file renames and moves as revisions by default, with a separate option to disable this. Folder renames relocate pending work without directly incrementing the contained notes.
- By default, confirmed automatic link rewrites update `updated` without changing or inserting `revision`. Enable automatic-link counting to count them too. Additional genuine edits and uncertain attribution remain counted normally.
- Preserve explicitly saved settings. The new defaults apply only to unset options; no bulk migration or counter reset is performed.
- Extend journal/recovery guards for initialization, timestamp-only link sessions, duplicate events and genuine edits arriving during retries. Validate formatting, build and all 103 automated tests.
- Keep additional revision formats, including semantic versions, on the roadmap for a later release.

## 0.1.9

- Defer unrendered Templater frontmatter without parsing or modifying template source files.
- Isolate malformed frontmatter during checkpoints so other notes remain recoverable.
- Report invalid YAML with the note path and no private parser excerpts.
- Simplify README notices and add a direct issue-reporting link.

## 0.1.8

- Keep pending sessions and recovery paths attached to renamed files, including renames during hashing, reads and writes.
- Add optional "Count file renames as revisions", off by default; combine content edits and file renames in one session and recover without duplicate increments.
- Cover edit, rename, immediate quit and restart with synthetic desktop and mobile lifecycle tests.
- Start new installations with an empty excluded-folders list instead of personal vault conventions.
- Preserve every existing saved exclusion list and the ability to configure root folders and their descendants.
- Verify both the empty new-install UI/runtime and unchanged loading of existing settings.

## 0.1.7

- Prepare the first installable release with MIT licensing.
- Shorten the README around behavior, installation and essential settings; move implementation and compatibility details into focused guides.
- Include the license in the built plugin so installed copies retain the copyright and permission notice.
- Retain the existing session, timestamp, optional counter and recovery behavior. Community-directory submission is performed by the repository owner.

## 0.1.6

- Refactor the plugin and settings tab into top-level Obsidian classes with named rendering and lifecycle methods.
- Separate session/recovery decisions, Obsidian events, guarded note access and the native save-command adapter. Return an explicit runtime object instead of attaching methods to a stop function.
- Preserve settings, recovery namespaces, note comparison rules, session boundaries and metadata output.
- Add pinned formatting rules and module-level architecture documentation; retain all existing acceptance scenarios and add focused save-command boundary checks.

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
