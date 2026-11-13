# Architecture and extraction decisions

## Reference implementation

The internal reference currently lives in Continuum:

- `scripts/maintenance/edit-sessions.mjs`
- `scripts/maintenance/edit-sessions.md`
- `scripts/startup.mjs`
- `scripts/.dev/tests/edit-sessions.test.mjs`
- `scripts/.dev/tests/edit-sessions-runtime.test.mjs`

The helper, synthetic tests and behavior specification were extracted into this repository. `extraction-source.json` records hashes of the source inputs. No personal notes, vault settings, recovery state or journals were copied. The internal implementation remains in place until an explicitly authorized, validated migration.

## Module responsibilities

The entry point exports a normal top-level Obsidian plugin class. There is no class factory or whole-API injection around the plugin and settings screen.

| Module | Responsibility |
| --- | --- |
| `src/main.mjs` | Export the plugin class for bundling into `main.js`. |
| `src/plugin.mjs` | Own plugin lifecycle, commands, persisted settings and serialized runtime restarts. |
| `src/settings-tab.mjs` | Render native setting groups and keep unsaved edits in a draft. |
| `src/obsidian-runtime.mjs` | Connect editor/vault/window events to the session tracker; coordinate safe desktop quit. |
| `src/session-tracker.mjs` | Maintain sessions, fingerprints, baselines and write-ahead intentions; decide whether a revision is due. |
| `src/note-access.mjs` | Await existing native saves, validate current views and metadata, then write properties through `processFrontMatter`. Never invoke a view save. |
| `src/save-command.mjs` | Wrap the native explicit-save command while preserving its bindings, return values and availability checks. Restore only callbacks still owned by the plugin. |
| `src/note-content.mjs` | Compare semantic content, extract managed metadata and hash fingerprints. |
| `src/note-paths.mjs` | Define eligible Markdown paths and the default excluded folders. |
| `src/settings.mjs`, `src/properties.mjs` | Normalize settings and configured property names. |
| `src/storage.mjs` | Choose device-local namespaces and copy compatible previous-preview state without deleting originals. |
| `src/frontmatter-order.mjs` | Complete enabled property blocks locally while preserving unrelated order and complete manual arrangements. |

The runtime returns `{ stop, complete, pendingPaths }`. `stop()` invalidates writes and detaches listeners synchronously, then returns its checkpoint promise. `complete(path?)` completes safe saved sessions; `pendingPaths()` reports work that must remain journaled. The plugin stops the previous runtime before starting another one.

The session tracker remains a state-owning factory with injected file access, hashing and storage. Its closure keeps queues and recovery state private without requiring Obsidian in the core. The adapter likewise owns its event/timer state per runtime instance. No global singleton owns note sessions.

## Persistence and compatibility

Obsidian's `loadData()` / `saveData()` read and write `<vault>/.obsidian/plugins/revision-marks/data.json`. The settings tab only calls `applySettings()` after Save and apply; changing inputs does not mutate live settings.

Device-local state uses `revision-marks.v2:<vault identity>:<property mapping>` and its `:baselines` companion, isolated from the prototype and synced settings. Timestamp-only mode adds `:off` to its namespace. The refactor retains these keys, comparison versions and journal shapes; it does not migrate notes or reinterpret pending sessions.

Exclusions and all three property names are configurable. Defaults are `created`, `updated`, `revision`. An absent creation value is filled from the final updated value; existing creation metadata is preserved. Native setting groups let Obsidian and themes control layout spacing.

## Test and formatting boundaries

- Session/content tests import the core directly and supply synthetic files, local storage and clocks.
- Runtime and shutdown tests exercise the real adapter and writer with synthetic Obsidian surfaces, including the cleared-view regression and native quit-task ordering.
- Plugin lifecycle/settings tests load the actual bundle with replacement Obsidian APIs. Only `createRuntime()` is replaced for isolated lifecycle checks; production classes stay top-level.
- Save-command tests verify callback ownership, native failure handling, original return identity and side-effect-free availability checks.
- Prettier is pinned as a development dependency. `npm run check` checks formatting, builds the bundle and runs tests. Only the three deployable artifacts enter the vault.

Static tests do not establish live desktop/mobile event behavior. No runtime dependency or new save mechanism was introduced by separating these modules.

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
- Retained localStorage has explicit namespacing and format versions. Size limits, recovery UI and an explicit internal-helper-state migration remain future work; do not silently import that state.
- Validate multiple windows, dirty editor buffers, Properties/Bases changes and mobile activity transitions on real clients.
- Define conflict visibility and recovery commands before exposing unresolved journal entries to general users.
- Establish supported Obsidian versions and acceptable mobile startup overhead.
- Design completion actions only after the core is stable; a generic action system is not part of the initial extraction.
