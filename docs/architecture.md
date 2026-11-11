# Architecture and extraction decisions

## Reference implementation

The internal reference currently lives in Continuum:

- `scripts/maintenance/edit-sessions.mjs`
- `scripts/maintenance/edit-sessions.md`
- `scripts/startup.mjs`
- `scripts/.dev/tests/edit-sessions.test.mjs`
- `scripts/.dev/tests/edit-sessions-runtime.test.mjs`

These paths document the source of the behavior; no vault files or user data have been copied into this repository. The internal implementation remains in place until an explicitly authorized, validated migration.

## Proposed separation

1. A testable session state machine for content comparison, boundaries and write intentions.
2. Obsidian adapters for editor transactions, vault events, explicit save and lifecycle events.
3. Device-local persistence for fingerprints and pending sessions, separate from synced plugin settings.
4. A guarded metadata writer that verifies current content, fields and editor buffers.
5. Settings and diagnostic commands for exclusions, managed properties and pending work.

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
- Select standalone storage with explicit per-device behavior, bounded size, format versioning and migration from the prototype.
- Validate multiple windows, dirty editor buffers, Properties/Bases changes and mobile activity transitions on real clients.
- Define conflict visibility and recovery commands before exposing unresolved journal entries to general users.
- Establish supported Obsidian versions and acceptable mobile startup overhead.
- Design completion actions only after the core is stable; a generic action system is not part of the initial extraction.
