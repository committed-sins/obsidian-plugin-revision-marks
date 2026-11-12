# Revision Marks for Obsidian

Track meaningful editing sessions and mark what changed.

**Status: standalone development preview, version 0.1.5. Not yet released or submitted to the community directory. Desktop and Android live validation remains pending. Versions 0.1.0 and 0.1.1 have an unsafe shutdown save path; do not use them.**

Revision Marks tracks changed editing sessions instead of individual autosaves. Timestamps and revision counts update when you leave or explicitly save a note, keeping metadata writes out of your typing flow. Unchanged content and complete undo produce no update.

## Behavior

- Complete a changed session after native Obsidian persistence when leaving a note or explicitly saving it. The plugin never invokes a view's save method.
- On normal desktop quit, wait for Obsidian's registered native saves, then complete safe metadata updates before allowing the window to close.
- On plugin unload or mobile backgrounding, checkpoint pending metadata work. Complete it after the next safe startup or foreground return; this also recovers deferred desktop work.
- Compare the note body and frontmatter. Unchanged content or a complete undo must not change either managed field.
- Make all three property names configurable. Defaults are `created`, `updated`, `revision`; enabled update/counter fields are excluded from content comparison. With revision tracking off, the revision field is ordinary content.
- If the creation property is absent at a changed session's commit, fill it with the final updated value. Preserve an existing creation value.
- Set the timestamp from the saved file's local modification time before writing metadata, and increment the counter once.
- Observe edits through the Markdown editor, Bases, Properties, and external file changes.
- Avoid a second increment when an incoming change already carries a changed timestamp or counter.
- Retain device-local fingerprints and pending write intentions for restart recovery.
- Complete a partial session-property block in created/updated/revision order beside its first existing member, or at the bottom if none exist. Never globally reorder unrelated properties or rearrange a complete block.
- Preserve unrelated frontmatter, note content, and user-configured exclusions. Defer unsafe writes instead of overwriting divergent editor buffers.

The session boundary is the foundation. Other session-completion actions may follow later, after the timestamp/counter behavior is reliable.

## Scope and status

The standalone plugin was extracted from the current internal helper and its tests. It has its own lifecycle owner, commands, settings and a local session-field insertion helper; CodeScript Toolkit and Templater are not dependencies. Templates can continue supplying creation dates; only an absent creation property is filled by the plugin.

The Continuum module remains in place and is not changed or migrated by building/deploying this preview. Do not run both writers in the same vault.

## Build and test

Requires Node.js 22 or newer.

```sh
npm ci
npm run check
```

The check builds the browser-compatible CommonJS entry and runs the imported session/recovery/runtime tests plus plugin lifecycle, ordering and deployment checks. Test fixtures contain synthetic note content only. Build artifacts are `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`.

## Local test deployment

Copy `.env.example` to the ignored `.env.local` and set `OBSIDIAN_VAULT` to the intended test vault. Then run:

```sh
npm run deploy
```

Only the three artifacts are copied to `<vault>/.obsidian/plugins/revision-marks/`. Deployment preserves plugin `data.json`, notes, workspace state and the enabled-plugin list. Enable or reload **Revision Marks** manually in that test vault. No release is published by deployment.

## Settings and commands

- **Revision tracking:** `Counter` (default) keeps the existing increment-per-changed-session behavior. `Off` updates timestamps only: existing revision values and their placement are preserved, and no revision property is added. The revision property-name input is disabled while tracking is off.
- Apply mode changes after pending sessions complete under the previous mode. Recovery state is isolated by mode; an unfinished session blocks a mode change rather than being reinterpreted.
- Defaults: `created`, `updated`, `revision`, ISO timestamps with local timezone, and exclusions for `archives`, `scripts`, `libraries`, `templates`, `inbound`.
- Configure the three distinct top-level property names and excluded folders. Use `updated_count` or `updated_revision` instead of `revision` if preferred. Names apply to future tracking; existing note fields are not renamed or migrated automatically.
- Missing properties are added as one local block; the previous global frontmatter-order setting has been removed. Applying settings completes pending sessions under the previous names first.
- **Complete current session** and **Complete all sessions** are available in the command palette.
- Explicit **Save current file** / Ctrl+S also completes a changed session; autosave alone does not.

See [property names and insertion rules](docs/properties.md) for examples. Additional completion actions remain future work.

## State and limitations

Formerly **Session Marks** (`session-marks`). When renaming an existing installation, move its plugin folder to `revision-marks` before deploying the new build so `data.json` and other local files stay intact. Replace the old plugin ID in activation/hotkey references while keeping its enabled/disabled state; never enable both identities. On first use, Revision Marks copies the matching `session-marks.v2:` journal and baselines to its own namespace without deleting originals or overwriting existing new-name state.

Fingerprints and pending write intentions are device-local, under a `revision-marks.v2:` localStorage namespace scoped to the vault and all three property names. Synced plugin settings are separate. No internal-helper journal is imported automatically, and no note text is stored in the journal. The first baseline pass is paced in the background and does not stamp existing notes.

The previous 0.1.0 plugin journal can be copied into the new namespace when using its exact `created`/`updated`/`updated_count` mapping. If old sessions remain pending under that mapping, recover them before choosing different names. Originals are retained; a mapping change cannot silently reinterpret an old counter.

Normal desktop quit checkpoints first, waits for previously registered quit tasks (including Obsidian's native saves), and then awaits guarded metadata commits. The prior-task aggregate is captured before registering our own task to avoid waiting on ourselves. This uses the task collector verified in Obsidian 1.15.0; without that collector, quit checkpoints only. Failed native saves, unsaved/detached/dirty/divergent views and plugin unload retain pending work for recovery. Ordinary queued completion cannot gain the desktop quit task's write permission.

Pending metadata is recovered after native content persistence on the next safe startup or foreground return. The plugin does not force-save bodies. Mobile checkpointing remains best effort if the process is killed immediately. The journal contains fingerprints and metadata, not a backup of unsaved text; body persistence remains Obsidian's responsibility. Incoming changes that already modify either managed field are not counted again, but multi-device counters are not an atomic distributed counter. The explicit-save integration wraps an internal Obsidian command and awaits an existing native save promise; it needs live compatibility testing.

See [the captured reference behavior](docs/reference-behavior.md) for comparison/recovery rules and focused live checks. Its internal-module names describe the source implementation; the standalone plugin uses its own namespace and lifecycle.

## Design documents

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and extraction decisions](docs/architecture.md)
- [Implementation roadmap](docs/roadmap.md)

## Identity

- Name: **Revision Marks**
- Plugin ID: `revision-marks`
- Repository: `committed-sins/obsidian-plugin-revision-marks`
- Author: Michael J. Stallinger / Committed Sins

The preview requires Obsidian 1.15.0 and declares mobile support. That declaration is not proof of live Android validation. A distribution license and release process remain to be chosen before publication.
