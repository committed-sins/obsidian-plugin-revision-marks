# Session Marks for Obsidian

Track meaningful editing sessions and mark what changed.

**Status: standalone development preview, version 0.1.1. Not yet released or submitted to the community directory. Desktop and Android live validation remains pending.**

Session Marks treats an editing session as a unit of work. It compares actual content, then updates frontmatter timestamps and a revision counter at defined session boundaries instead of repeatedly interrupting typing.

## Behavior

- Complete a changed session when leaving a note, explicitly saving it, quitting Obsidian, or backgrounding the mobile activity.
- Compare the note body and frontmatter. Unchanged content or a complete undo must not change either managed field.
- Make all three property names configurable. Defaults are `created`, `updated`, `revision`; the update/counter fields are excluded from content comparison.
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

Only the three artifacts are copied to `<vault>/.obsidian/plugins/session-marks/`. Deployment preserves plugin `data.json`, notes, workspace state and the enabled-plugin list. Enable or reload **Session Marks** manually in that test vault. No release is published by deployment.

## Settings and commands

- Defaults: `created`, `updated`, `revision`, ISO timestamps with local timezone, and exclusions for `archives`, `scripts`, `libraries`, `templates`, `inbound`.
- Configure the three distinct top-level property names and excluded folders. Use `updated_count` or `updated_revision` instead of `revision` if preferred. Names apply to future tracking; existing note fields are not renamed or migrated automatically.
- Missing properties are added as one local block; the previous global frontmatter-order setting has been removed. Applying settings completes pending sessions under the previous names first.
- **Complete current session** and **Complete all sessions** are available in the command palette.
- Explicit **Save current file** / Ctrl+S also completes a changed session; autosave alone does not.

See [property names and insertion rules](docs/properties.md) for examples. Additional completion actions remain future work.

## State and limitations

Fingerprints and pending write intentions are device-local, under a `session-marks.v2:` localStorage namespace scoped to the vault and all three property names. Synced plugin settings are separate. No internal-helper journal is imported automatically, and no note text is stored in the journal. The first baseline pass is paced in the background and does not stamp existing notes.

The previous 0.1.0 plugin journal can be copied into the new namespace when using its exact `created`/`updated`/`updated_count` mapping. If old sessions remain pending under that mapping, recover them before choosing different names. Originals are retained; a mapping change cannot silently reinterpret an old counter.

Normal quit adds an awaited completion task. Android backgrounding is best effort; process termination may require recovery on the next launch. Incoming changes that already modify either managed field are not counted again, but multi-device counters are not an atomic distributed counter. The explicit-save integration wraps an internal Obsidian command and needs live compatibility testing.

See [the captured reference behavior](docs/reference-behavior.md) for comparison/recovery rules and focused live checks. Its internal-module names describe the source implementation; the standalone plugin uses its own namespace and lifecycle.

## Design documents

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and extraction decisions](docs/architecture.md)
- [Implementation roadmap](docs/roadmap.md)

## Identity

- Name: **Session Marks**
- Plugin ID: `session-marks`
- Repository: `committed-sins/obsidian-plugin-session-marks`
- Author: Michael J. Stallinger / Committed Sins

The preview requires Obsidian 1.15.0 and declares mobile support. That declaration is not proof of live Android validation. A distribution license and release process remain to be chosen before publication.
