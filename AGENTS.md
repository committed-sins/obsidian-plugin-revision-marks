# Contributor instructions

- Sign every Git commit with the configured backend/key and verify its signature. Never bypass signing. If signing fails, preserve files uncommitted. Do not rewrite signed commits because verifier/trust configuration is missing.
- Use English commit messages.
- Preserve note bodies, IDs, links and unrelated frontmatter. Unchanged semantic content must not update either managed field.
- Treat autosave, explicit save and session completion as distinct events. Preserve idempotent recovery and safeguards against duplicate sync increments.
- Keep device-local recovery data separate from synced settings. Never store full note text in diagnostics or recovery records.
- Use synthetic fixtures for tests. Cover complete undo, properties, external writes, multiple editors, interruption/recovery and concurrent changes.
- Do not deploy to a vault, migrate notes or publish a release without user authorization.
- Static tests and simulated lifecycle events do not establish real desktop or Android behavior. Report live validation separately.
