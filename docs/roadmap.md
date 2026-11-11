# Roadmap

1. Review the current internal helper and preserve its behavior in synthetic acceptance fixtures.
2. Extract the session state machine and storage adapters into a standalone TypeScript plugin with configurable fields and exclusions.
3. Implement editor/vault/lifecycle integration, guarded writes and explicit-save handling without CodeScript Toolkit.
4. Add settings, pending-session diagnostics and safe recovery controls.
5. Validate desktop and Android: typing/completion, undo, Ctrl+S, Properties/Bases, external changes, multiple views, backgrounding, quit and interruption recovery.
6. Measure startup/indexing overhead on mobile and compare against the internal helper.
7. Prepare license, CI, packaging, migration instructions and a first release.
8. Only after explicit authorization, migrate the vault from its internal helper to the plugin; do not run both writers together.

Repository initialization creates planning artifacts only. It does not deploy a plugin, alter the running internal module, migrate notes or publish a release.
