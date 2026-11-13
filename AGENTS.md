# Contributor instructions

- Sign every Git commit with the configured backend/key and verify its signature. Never bypass signing. If signing fails, preserve files uncommitted. Do not rewrite signed commits because verifier/trust configuration is missing.
- Use English commit messages.
- Use Allman opening braces for functions, block-bodied arrow functions, methods/constructors/accessors and classes: place `{` on the following line. Keep control-flow blocks (`if`, loops, `try/catch`, etc.) in their existing style. Preserve JavaScript syntax and automatic-semicolon-insertion behavior; never put a return value on a new line immediately after `return`, or split arrow parameters from `=>`.
- Run `npm run format` and `npm run format:check` for the pinned dprint rules in `dprint.json`. Do not reintroduce a formatter that overrides the Allman convention.
- Preserve note bodies, IDs, links and unrelated frontmatter. Unchanged semantic content must not update either managed field.
- Treat autosave, explicit save and session completion as distinct events. Preserve idempotent recovery and safeguards against duplicate sync increments.
- Keep device-local recovery data separate from synced settings. Never store full note text in diagnostics or recovery records.
- Use synthetic fixtures for tests. Cover complete undo, properties, external writes, multiple editors, interruption/recovery and concurrent changes.
- Do not deploy to a vault, migrate notes or publish a release without user authorization.
- Static tests and simulated lifecycle events do not establish real desktop or Android behavior. Report live validation separately.
- Run `npm ci` and `npm run check` for a fresh checkout. Deploy only to the explicitly authorized target through `OBSIDIAN_VAULT` or an ignored `.env.local`; deployment must preserve settings and activation state.
