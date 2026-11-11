# Session Marks for Obsidian

Track meaningful editing sessions and mark what changed.

**Status: planning and extraction repository. The reference implementation runs as an internal Continuum module; no standalone plugin or release is available yet.**

Session Marks treats an editing session as a unit of work. It compares actual content, then updates frontmatter timestamps and a revision counter at defined session boundaries instead of repeatedly interrupting typing.

## Planned behavior

- Complete a changed session when leaving a note, explicitly saving it, quitting Obsidian, or backgrounding the mobile activity.
- Compare the note body and frontmatter. Unchanged content or a complete undo must not change either managed field.
- Ignore the managed fields themselves (`updated` and `updated_count` by default); leave creation-date management to templates or other tools.
- Set the timestamp from the saved file's local modification time before writing metadata, and increment the counter once.
- Observe edits through the Markdown editor, Bases, Properties, and external file changes.
- Avoid a second increment when an incoming change already carries a changed timestamp or counter.
- Retain device-local fingerprints and pending write intentions for restart recovery.
- Preserve unrelated frontmatter, note content, and user-configured exclusions. Defer unsafe writes instead of overwriting divergent editor buffers.

The session boundary is the foundation. Other session-completion actions may follow later, after the timestamp/counter behavior is reliable.

## Scope and status

The current internal helper is a prototype, not proof of a production-ready plugin. It is coupled to CodeScript Toolkit, vault-specific settings and a locally observed Obsidian command implementation. Extraction must retain behavior while replacing that integration with a standalone plugin lifecycle and settings.

No production-vault migration, deployment, release, or directory submission is part of this repository initialization.

## Design documents

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and extraction decisions](docs/architecture.md)
- [Implementation roadmap](docs/roadmap.md)

## Identity

- Name: **Session Marks**
- Intended plugin ID: `session-marks`
- Repository: `committed-sins/obsidian-plugin-session-marks`
- Author: Michael J. Stallinger / Committed Sins

The plugin manifest, supported minimum Obsidian version, license and release version will be established during implementation.
