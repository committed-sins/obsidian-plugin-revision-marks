# Architecture and extraction decisions

## Reference implementation

The internal reference currently lives in Continuum:

- `scripts/maintenance/edit-sessions.mjs`
- `scripts/maintenance/edit-sessions.md`
- `scripts/startup.mjs`
- `scripts/.dev/tests/edit-sessions.test.mjs`
- `scripts/.dev/tests/edit-sessions-runtime.test.mjs`

The helper, synthetic tests and behavior specification were extracted into this repository. `extraction-source.json` records hashes of the source inputs. No personal notes, vault settings, recovery state or journals were copied. The internal implementation remains in place until an explicitly authorized, validated migration.

## Implemented extraction

1. `src/edit-sessions.mjs` retains the state machine, guarded writer and editor/vault/lifecycle integration from the current helper.
2. `src/plugin.mjs` supplies a standalone Obsidian lifecycle owner, completion commands and settings UI. Runtime restarts await cleanup; each plugin instance owns its editor extension.
3. Device-local state uses `session-marks.v1:<vault path/name>` and its `:baselines` companion, isolated from the prototype and synced settings.
4. `src/frontmatter-order.mjs` bundles the reference order and reorders only when managed properties are first added. It has no Templater or metadata-note dependency.
5. Exclusions and initial property ordering are configurable. Managed property names remain `updated` and `updated_count` for the first preview.

## Decisions to retain

- Hash semantic content; do not put note text into recovery storage.
- Preserve the existing meaning of unchanged content and complete undo.
- Treat explicit save differently from autosave.
- Use local file mtime only after content comparison and managed-field checks.
- Establish initial fingerprints without mass-stamping the vault.
- Pace initial indexing and subsequently inspect only missing/changed file stats.
- Serialize completion and handle duplicate lifecycle events idempotently.

## Decisions requiring validation

- The prototype wraps the internal `editor:save-file` command because no public post-save event was identified. Confirm compatibility and a safe failure mode.
- Retained localStorage has explicit namespacing and existing format versions. Size limits, recovery UI and an explicit prototype-state migration remain future work; do not silently import state.
- Validate multiple windows, dirty editor buffers, Properties/Bases changes and mobile activity transitions on real clients.
- Define conflict visibility and recovery commands before exposing unresolved journal entries to general users.
- Establish supported Obsidian versions and acceptable mobile startup overhead.
- Design completion actions only after the core is stable; a generic action system is not part of the initial extraction.
