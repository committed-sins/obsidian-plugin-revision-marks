# Roadmap

1. Done: capture the current internal helper and preserve its behavior in synthetic acceptance fixtures.
2. Done: build a standalone JavaScript plugin retaining the state machine and device-local persistence, with configurable exclusions and property names.
3. Done: wire editor/vault/lifecycle integration, guarded writes and explicit-save handling to the plugin owner, without CodeScript Toolkit.
4. Settings, configurable property names, local session-block insertion and completion commands are implemented. Pending-session diagnostics and recovery controls remain open.
5. Validate desktop and Android: typing/completion, undo, Ctrl+S, Properties/Bases, external changes, multiple views, backgrounding, quit and interruption recovery.
6. Measure startup/indexing overhead on mobile and compare against the internal helper.
7. Done: MIT licensing, CI builds, signed release tags and attested release assets. Maintain compatibility and upgrade documentation as behavior evolves.
8. Only after explicit authorization, migrate the vault from its internal helper to the plugin; do not run both writers together.

## Optional revision formats

The revision-mode dropdown currently offers Off and Counter, with Counter preserving the original behavior. Deferred to a version after 0.1.10: additional optional counting methods. A three-part version mode should use patch increments at existing session boundaries, minor increments on explicit Save current file / Ctrl+S, and major increments through a command with a user-assigned shortcut. Explicit save must choose minor instead of also applying patch for the same completion. Unchanged content and complete undo remain no-ops. These version commands and formats are not implemented yet. A visible content-hash property is not planned; internal fingerprints remain solely for comparison and recovery.
