import assert from "node:assert/strict";
import test from "node:test";
import { startEditSessions } from "../src/edit-sessions.mjs";

const info = text => {
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    return match ? { exists: true, frontmatter: match[1], contentStart: match[0].length } : { exists: false };
};
const note = (body, count = 4) => `---\n${JSON.stringify({ updated_count: count, id: "kept" })}\n---\n${body}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test("editor integration counts only full-note user input; leaving commits native-saved content once", async () => {
    const priorStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const journal = new Map();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
        getItem: key => journal.get(key), setItem: (key, value) => journal.set(key, value)
    } });
    const callbacks = new Map();
    const emitter = prefix => ({
        on: (name, callback) => { const key = prefix + name; callbacks.set(key, callback); return key; },
        offref: key => callbacks.delete(key)
    });
    const file = { path: "notes/A.md" };
    let active = file, disk = note("before"), buffer = disk, writes = 0, saves = 0, extension, registrations = 0;
    const notices = [];
    const view = { file, editor: { getValue: () => buffer }, getViewData: () => buffer, save: async () => { saves++; disk = buffer; } };
    const app = {
        commands: { commands: { "editor:save-file": { callback: () => view.save() } } },
        plugins: { plugins: { "revision-marks": { registerEditorExtension: value => { extension = value; registrations++; } } } },
        workspace: { ...emitter("workspace:"), getActiveFile: () => active, iterateAllLeaves: fn => fn({ view }) },
        vault: { ...emitter("vault:"), adapter: {}, getName: () => "test-runtime", getAbstractFileByPath: path => path === file.path ? file : null,
            read: async () => disk },
        fileManager: { processFrontMatter: async (_file, update) => {
            writes++;
            const fm = JSON.parse(info(disk).frontmatter); update(fm);
            disk = `---\n${JSON.stringify(fm)}\n---\n${disk.slice(info(disk).contentStart)}`;
            buffer = disk;
        } }
    };
    const api = { getFrontMatterInfo: info, parseYaml: JSON.parse, formatDate: value => value, properties: { created: "created", updated: "updated", revision: "updated_count" },
        EditorView: { updateListener: { of: callback => callback } }, editorInfoField: "info",
        Notice: class { constructor(message) { notices.push(message); } } };
    const dispatch = (before, after, event, editorValue = after) => {
        buffer = editorValue;
        extension({ docChanged: true, transactions: [{ isUserEvent: name => name === event }],
            startState: { doc: { toString: () => before } },
            state: { doc: { toString: () => after }, field: () => ({ file, editor: view.editor }) } });
    };
    let stop;
    try {
        stop = startEditSessions(app, { ...api, owner: app.plugins.plugins["revision-marks"] });
        dispatch(disk, note("sync"), "set"); // Programmatic replacement must not start a session.
        dispatch("a", "b", "input", note("before")); // Embedded cell is not a whole note.
        await wait(180);
        assert.equal(writes, 0);
        dispatch(note("before"), note("changed"), "input");
        await view.save(); // Ctrl+S / autosave does not finish a session.
        callbacks.get("workspace:layout-change")(); await wait(180);
        assert.equal(writes, 0);
        active = { path: "notes/B.md" };
        callbacks.get("workspace:active-leaf-change")(); await wait(220);
        assert.equal(writes, 1); assert.equal(saves, 1, 'only the native save writes the body');
        assert.equal(JSON.parse(info(disk).frontmatter).updated_count, 5);
        assert.equal(JSON.parse(info(disk).frontmatter).id, "kept");
        assert.deepEqual(Object.keys(JSON.parse(info(disk).frontmatter)), ["created", "updated", "updated_count", "id"]);
        assert.deepEqual(notices, []);
        await stop(); stop = undefined;
        stop = startEditSessions(app, { ...api, owner: app.plugins.plugins["revision-marks"] });
        assert.equal(registrations, 1, "tracking restart reuses the existing CodeMirror extension");
    } finally {
        await stop?.();
        if (priorStorage) Object.defineProperty(globalThis, "localStorage", priorStorage);
        else delete globalThis.localStorage;
    }
    assert.equal(callbacks.size, 0);
});

test("save command and Bases/properties complete sessions; quit and Android background defer metadata safely", async () => {
    const originals = new Map(["localStorage", "document", "window"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const journal = new Map(), callbacks = new Map(), domCallbacks = new Map();
    const emitter = prefix => ({
        on: (name, callback) => { const key = prefix + name; callbacks.set(key, callback); return key; },
        offref: key => callbacks.delete(key)
    });
    const surface = prefix => ({
        addEventListener: (name, fn) => domCallbacks.set(prefix + name, fn),
        removeEventListener: name => domCallbacks.delete(prefix + name)
    });
    const document = { ...surface("document:"), visibilityState: "visible" };
    for (const [name, value] of Object.entries({ document, window: surface("window:"), localStorage: {
        getItem: key => journal.get(key), setItem: (key, value) => journal.set(key, value)
    } })) Object.defineProperty(globalThis, name, { configurable: true, value });
    const file = { path: "notes/A.md", stat: { mtime: 1700000000000 } };
    let active = file, disk = note("before"), buffer = disk, extension, writes = 0;
    const fm = () => JSON.parse(info(disk).frontmatter);
    const view = { file, editor: { getValue: () => buffer }, getViewData: () => buffer, save: async () => {
        if (buffer !== disk) { disk = buffer; file.stat.mtime += 1000; }
    } };
    const originalSave = checking => { if (!checking) void view.save(); return true; };
    const command = { checkCallback: originalSave };
    const notices = [];
    const app = {
        commands: { commands: { "editor:save-file": command } },
        plugins: { plugins: { "revision-marks": { registerEditorExtension: value => { extension = value; } } } },
        workspace: { ...emitter("workspace:"), getActiveFile: () => active, iterateAllLeaves: fn => fn({ view }) },
        vault: { ...emitter("vault:"), adapter: {}, getName: () => "events-runtime", getMarkdownFiles: () => [file],
            getAbstractFileByPath: path => path === file.path ? file : null, read: async () => disk },
        fileManager: { processFrontMatter: async (_file, update) => {
            const metadata = fm(); update(metadata); writes++;
            disk = `---\n${JSON.stringify(metadata)}\n---\n${disk.slice(info(disk).contentStart)}`;
            buffer = disk; file.stat.mtime += 1000;
            void callbacks.get("vault:modify")?.(file); // Must not create a feedback loop.
        } }
    };
    const api = { getFrontMatterInfo: info, parseYaml: JSON.parse, formatDate: value => value, properties: { created: "created", updated: "updated", revision: "updated_count" }, Platform: { isMobile: true },
        EditorView: { updateListener: { of: callback => callback } }, editorInfoField: "info",
        Notice: class { constructor(message) { notices.push(message); } } };
    const edit = text => {
        const before = buffer;
        buffer = `---\n${JSON.stringify(fm())}\n---\n${text}`;
        extension({ docChanged: true, transactions: [{ isUserEvent: name => name === "input" }],
            startState: { doc: { toString: () => before } },
            state: { doc: { toString: () => buffer }, field: () => ({ file, editor: view.editor }) } });
    };
    let stop;
    try {
        stop = startEditSessions(app, { ...api, owner: app.plugins.plugins["revision-marks"] });
        await wait(1100); // Initial baseline pass; no backdating or counting.
        assert.equal(writes, 0);
        active = { path: "views/example.base" };
        disk = buffer = `---\n${JSON.stringify({ ...fm(), tags: ["from-base"] })}\n---\nbefore`;
        file.stat.mtime += 1000;
        const expectedMtime = new Date(file.stat.mtime).toISOString();
        await callbacks.get("vault:modify")(file);
        assert.equal(fm().updated_count, 5); assert.equal(fm().updated, expectedMtime);
        active = file;
        disk = buffer = `---\n${JSON.stringify({ ...fm(), tags: ["from-sidebar"] })}\n---\nbefore`;
        file.stat.mtime += 1000;
        await callbacks.get("vault:modify")(file);
        assert.equal(fm().updated_count, 5, "active property edit stays pending until a session boundary");
        assert.equal(command.checkCallback(true), true); await wait(30);
        assert.equal(fm().updated_count, 5, "availability checks never trigger completion");
        assert.equal(command.checkCallback(false), true); await wait(60);
        assert.equal(fm().updated_count, 6);
        edit("after save"); command.checkCallback(false); await wait(60);
        assert.equal(fm().updated_count, 7);
        command.checkCallback(false); await wait(60); assert.equal(fm().updated_count, 7);
        edit("before quit");
        await view.save();
        const tasks = [];
        callbacks.get("workspace:quit")({ add: fn => tasks.push(fn()) });
        await Promise.all(tasks); assert.equal(fm().updated_count, 7);
        await stop();
        stop = startEditSessions(app, { ...api, owner: app.plugins.plugins["revision-marks"] });
        await wait(60); assert.equal(fm().updated_count, 8, 'restart recovers the pending session');
        edit("before hiding"); document.visibilityState = "hidden";
        await view.save();
        domCallbacks.get("document:visibilitychange")(); await wait(60);
        assert.equal(fm().updated_count, 8);
        document.visibilityState = 'visible'; domCallbacks.get('document:visibilitychange')(); await wait(60);
        assert.equal(fm().updated_count, 9);
        edit("before Android blur"); await view.save(); domCallbacks.get("window:blur")(); await wait(60);
        assert.equal(fm().updated_count, 9);
        domCallbacks.get("window:pagehide")(); await wait(60);
        domCallbacks.get('window:focus')(); await wait(60);
        assert.equal(fm().updated_count, 10, "duplicate lifecycle events do not double count");
        edit("before plugin cleanup without quit");
        await view.save();
        await stop(); stop = undefined;
        assert.equal(fm().updated_count, 10, "plugin cleanup never writes notes");
        // Existing timestamps but no counter: create it in the central order, preserve custom values.
        stop = startEditSessions(app, { ...api, owner: app.plugins.plugins["revision-marks"] });
        await wait(60); assert.equal(fm().updated_count, 11);
        disk = buffer = `---\n${JSON.stringify({ id: "kept", created: "2026-01-01", updated: "older", tags: ["keep"], custom: { nested: true } })}\n---\nbefore counter`;
        edit("after counter"); command.checkCallback(false); await wait(60);
        assert.equal(fm().updated_count, 1);
        assert.deepEqual(Object.keys(fm()), ["id", "created", "updated", "updated_count", "tags", "custom"]);
        assert.deepEqual(fm().tags, ["keep"]); assert.deepEqual(fm().custom, { nested: true });
        await stop(); stop = undefined;
        // Custom names, a single existing timestamp in the middle, and no implicit legacy-field rename.
        const customProperties = { created: 'born', updated: 'touched', revision: 'updated_revision' };
        disk = buffer = `---\n${JSON.stringify({ id: 'kept', title: 'before block', touched: 'old', custom: true, updated_count: 40 })}\n---\ncustom before`;
        stop = startEditSessions(app, { ...api, properties: customProperties, owner: app.plugins.plugins["revision-marks"] });
        edit('custom after'); command.checkCallback(false); await wait(60);
        assert.equal(fm().born, fm().touched); assert.equal(fm().updated_revision, 1);
        assert.equal(fm().updated_count, 40, 'unconfigured legacy counter is not renamed or overwritten');
        assert.deepEqual(Object.keys(fm()), ['id', 'title', 'born', 'touched', 'updated_revision', 'custom', 'updated_count']);
        // Once complete, even an intentionally scattered order is kept on the next session.
        disk = buffer = `---\n${JSON.stringify({ updated_revision: 1, title: 'between', touched: fm().touched, custom: true, born: fm().born })}\n---\nmanual order`;
        const manualOrder = Object.keys(fm());
        edit('manual order edited'); command.checkCallback(false); await wait(60);
        assert.deepEqual(Object.keys(fm()), manualOrder); assert.equal(fm().updated_revision, 2);
        assert.deepEqual(notices, []);
    } finally {
        await stop?.();
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(command.checkCallback, originalSave);
    assert.equal(callbacks.size, 0); assert.equal(domCallbacks.size, 0);
});
