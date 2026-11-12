# Roadmap

1. Done: capture the current internal helper and preserve its behavior in synthetic acceptance fixtures.
2. Done: build a standalone JavaScript plugin retaining the state machine and device-local persistence, with configurable exclusions and property names.
3. Done: wire editor/vault/lifecycle integration, guarded writes and explicit-save handling to the plugin owner, without CodeScript Toolkit.
4. Settings, configurable property names, local session-block insertion and completion commands are implemented. Pending-session diagnostics and recovery controls remain open.
5. Validate desktop and Android: typing/completion, undo, Ctrl+S, Properties/Bases, external changes, multiple views, backgrounding, quit and interruption recovery.
6. Measure startup/indexing overhead on mobile and compare against the internal helper.
7. Prepare license, CI, packaging, migration instructions and a first release.
8. Only after explicit authorization, migrate the vault from its internal helper to the plugin; do not run both writers together.

The 0.1.3 preview retains the fix for the unsafe shutdown save path in 0.1.0/0.1.1 and is available for explicitly authorized local test-vault deployment. Normal desktop quit awaits native saves and guarded metadata completion; unload/mobile background use safe recovery. The running Continuum module remains untouched; no production migration or release has been performed.
