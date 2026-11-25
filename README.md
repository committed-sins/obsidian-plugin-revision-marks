# Revision Marks

**Requires Obsidian 1.15.0 or newer.**

Update timestamps and optional revision counts at the end of a meaningful editing session. Revision Marks compares actual content and waits until you leave a note, switch to reading view or explicitly save, keeping metadata writes out of your typing flow. Unchanged content and complete undo produce no update.

## Features

- Track editor, Properties, Bases and external changes to Markdown notes.
- Configure the `created`, `updated` and `revision` property names; turn counting off if preferred.
- Fill an absent creation timestamp without replacing an existing value.
- Complete saved sessions on desktop quit; retain pending work for recovery.
- Preserve unrelated frontmatter and manually arranged complete property blocks.

## Installation

Manual installation:

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/committed-sins/obsidian-plugin-revision-marks/releases/latest).
2. Place them in `<vault>/.obsidian/plugins/revision-marks/`.
3. Reload Obsidian and enable **Revision Marks** in Community plugins.

Disable other automatic writers of these properties first. Existing notes are not bulk-stamped or renamed. Test disposable notes before using a working vault. See the [manual test guide](docs/testing.md).

## Settings

**Revision tracking:** Counter is the default; Off updates timestamps only and leaves existing revision values untouched. Property names are configurable, including `updated_count` for an existing counter. “Count file renames as revisions” is on by default. “Count automatic link updates as revisions” is off by default: confirmed automatic link rewrites update the timestamp without changing or inserting a revision counter; uncertain attribution or additional content edits still count. Folder renames do not create revisions in the renamed notes themselves. New notes start at revision 0 by default; their first content edit becomes 1. Initialization waits for a safe session boundary. The starting value is configurable; missing counters on existing notes use that value at their next completed change. Existing counters continue with +1. Explicitly saved settings are preserved. Save and apply completes pending sessions under the old settings first.

Hidden/system folders (such as `.obsidian`, `.trash` and `.git`) and the configured Obsidian configuration folder are always ignored. During one-time setup, the configured attachment-folder rule is added if missing, including to existing exclusion lists: a fixed `attachments` folder excludes that root folder, while `./_assets` becomes `**/_assets` and matches that folder at any depth. Root/same-folder attachment locations add no exclusion. Each folder entry includes its descendants; a trailing `/` is optional. User-defined exclusions are retained. Setup completion is saved so a later deliberate removal is respected. Add your template folder if template source files should not be tracked; unrendered Templater expressions in frontmatter are deferred automatically.

**Complete current session**, **Complete all sessions** and explicit **Save current file / Ctrl+S** finish changed sessions. Autosave alone does not.

## Report a problem

Please [open an issue](https://github.com/committed-sins/obsidian-plugin-revision-marks/issues/new) with your Obsidian/plugin versions, platform and steps to reproduce.

## Development

Node.js 22+: run `npm ci`, then `npm run check` for formatting, build and tests. Use `npm run format` for the configured Allman style.

[Architecture](docs/architecture.md) · [Property rules](docs/properties.md) · [Development and compatibility](docs/development.md)

## License

[MIT](LICENSE) · Copyright © 2026 Michael J. Stallinger
