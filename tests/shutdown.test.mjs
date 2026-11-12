import assert from 'node:assert/strict';
import test from 'node:test';
import { startEditSessions } from '../src/edit-sessions.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const info = text => {
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    return match ? { exists: true, frontmatter: match[1], contentStart: match[0].length } : { exists: false };
};
const note = body => `---\n${JSON.stringify({ created: '2020-01-01', updated: '2020-01-01', revision: 1 })}\n---\n${body}`;

// Matches Obsidian 1.15's quit task collector, including immediate add execution
// and the snapshot taken by Promise.all in promise().
class QuitTasks {
    promises = [];
    add(fn) { this.promises.push(fn()); }
    addPromise(promise) { this.promises.push(promise); }
    promise() { return Promise.all(this.promises); }
}

async function fixture(run) {
    const originals = new Map(['localStorage', 'window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const callbacks = new Map(), journal = new Map();
    const emitter = prefix => ({ on(name, fn) { callbacks.set(prefix + name, fn); return prefix + name; }, offref(key) { callbacks.delete(key); } });
    const surface = prefix => ({ addEventListener(name, fn) { callbacks.set(prefix + name, fn); }, removeEventListener(name) { callbacks.delete(prefix + name); } });
    const document = { ...surface('document:'), visibilityState: 'visible' };
    for (const [key, value] of Object.entries({ document, window: surface('window:'), localStorage: {
        getItem: key => journal.get(key), setItem: (key, value) => journal.set(key, value)
    } })) Object.defineProperty(globalThis, key, { configurable: true, value });
    const file = { path: 'notes/synthetic.md', stat: { mtime: 1730000000000 } };
    let disk = note('before'), buffer = disk, modeData = disk, extension, saves = 0, writes = 0, stop;
    const view = { file, dirty: false, data: disk, lastSavedData: disk, savePromise: null,
        editor: { getValue: () => buffer }, getViewData: () => modeData,
        // Model TextFileView.save: the view mode, not editor.getValue(), supplies the write.
        async save() {
            saves++; this.dirty = false;
            while (this.savePromise) await this.savePromise;
            const text = this.getViewData();
            if (this.lastSavedData !== null && this.lastSavedData !== text) {
                this.data = this.lastSavedData = text; disk = text; file.stat.mtime += 1000;
            }
        }
    };
    const api = { getFrontMatterInfo: info, parseYaml: JSON.parse, formatDate: value => value,
        EditorView: { updateListener: { of: fn => fn } }, editorInfoField: 'info', Platform: { isMobile: true },
        Notice: class {}, owner: { registerEditorExtension: fn => { extension = fn; } } };
    const app = {
        commands: { commands: { 'editor:save-file': { checkCallback(checking) { if (!checking) void view.save(); return true; } } } },
        workspace: { ...emitter('workspace:'), getActiveFile: () => file, iterateAllLeaves: fn => fn({ view }) },
        vault: { ...emitter('vault:'), adapter: {}, getName: () => 'shutdown-fixture',
            getAbstractFileByPath: path => path === file.path ? file : null, read: async () => disk },
        fileManager: { async processFrontMatter(_file, update) {
            const metadata = JSON.parse(info(disk).frontmatter); update(metadata); writes++;
            disk = `---\n${JSON.stringify(metadata)}\n---\n${disk.slice(info(disk).contentStart)}`;
            buffer = modeData = view.data = view.lastSavedData = disk;
        } }
    };
    const edit = () => {
        const before = buffer; buffer = modeData = note('edited body must survive'); view.dirty = true;
        extension({ docChanged: true, transactions: [{ isUserEvent: event => event === 'input' }],
            startState: { doc: { toString: () => before } },
            state: { doc: { toString: () => buffer }, field: () => ({ file, editor: view.editor }) } });
    };
    const start = () => { stop = startEditSessions(app, api); };
    const end = async () => { const previous = stop; stop = undefined; await previous?.(); };
    try {
        start();
        await run({ app, api, callbacks, journal, document, view, edit, start, end,
            clearMode: () => { modeData = ''; }, disk: () => disk, saves: () => saves, writes: () => writes,
            complete: () => stop.complete(), pending: () => stop.pendingPaths() });
    } finally {
        await end();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
}

test('quit and unload never save a cleared view mode over a valid saved editor buffer', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save();
        const saved = f.disk(), saves = f.saves();
        f.clearMode();
        const tasks = [];
        f.callbacks.get('workspace:quit')({ add: fn => tasks.push(fn()) });
        await Promise.all(tasks); await f.end();
        assert.equal(f.disk(), saved, 'shutdown must preserve the full saved body');
        assert.equal(f.saves(), saves, 'plugin must never call native view.save');
        assert.equal(f.writes(), 0, 'shutdown performs no frontmatter writes');
        assert.ok([...f.journal.values()].some(raw => JSON.parse(raw).entries?.some(entry => entry.path === 'notes/synthetic.md')));
    });
});

test('unsaved completion is deferred; native save then completes exactly once', async () => {
    await fixture(async f => {
        f.edit(); const saved = f.disk();
        await f.complete();
        assert.equal(f.disk(), saved); assert.equal(f.saves(), 0); assert.equal(f.pending().length, 1);
        f.app.commands.commands['editor:save-file'].checkCallback(false); await wait(60);
        assert.equal(f.saves(), 1); assert.equal(f.writes(), 1);
        assert.equal(JSON.parse(info(f.disk()).frontmatter).revision, 2);
        await f.complete(); assert.equal(f.writes(), 1);
    });
});

test('queued completion is cancelled by quit; journal recovery completes once on restart', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save();
        const completion = f.complete();
        const tasks = [];
        f.callbacks.get('workspace:quit')({ add: fn => tasks.push(fn()) });
        await Promise.all([completion, ...tasks]); await f.end();
        assert.equal(f.writes(), 0);
        f.start(); await wait(60);
        assert.equal(f.writes(), 1); assert.equal(JSON.parse(info(f.disk()).frontmatter).revision, 2);
        await f.end(); f.start(); await wait(60); assert.equal(f.writes(), 1);
    });
});

test('mobile background checkpoints only; returning completes a saved session', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save(); const saved = f.disk();
        f.document.visibilityState = 'hidden'; f.callbacks.get('document:visibilitychange')();
        f.callbacks.get('window:blur')(); f.callbacks.get('window:pagehide')(); await wait(60);
        assert.equal(f.disk(), saved); assert.equal(f.writes(), 0); assert.equal(f.saves(), 1);
        f.document.visibilityState = 'visible'; f.callbacks.get('document:visibilitychange')(); await wait(60);
        assert.equal(f.writes(), 1); assert.equal(f.saves(), 1);
    });
});

test('plugin unload without quit preserves saved content even after the mode clears', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save(); const saved = f.disk(); f.clearMode();
        await f.end(); assert.equal(f.disk(), saved); assert.equal(f.saves(), 1); assert.equal(f.writes(), 0);
    });
});

test('cleared or detached views defer completion even outside shutdown', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save(); const saved = f.disk(); f.clearMode();
        await f.complete(); assert.equal(f.disk(), saved); assert.equal(f.pending().length, 1);
        assert.equal(f.writes(), 0); assert.equal(f.saves(), 1);
    });
});

test('boolean native Save command waits for its existing savePromise without a second save', async () => {
    await fixture(async f => {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const nativeSave = f.view.save.bind(f.view);
        f.view.save = () => {
            f.view.savePromise = gate.then(() => { f.view.savePromise = null; return nativeSave(); });
            return f.view.savePromise;
        };
        f.edit(); assert.equal(f.app.commands.commands['editor:save-file'].checkCallback(false), true);
        await wait(20); assert.equal(f.writes(), 0); assert.equal(f.saves(), 0);
        release(); await wait(60); assert.equal(f.writes(), 1); assert.equal(f.saves(), 1);
    });
});

test('quit cancels a completion already waiting for native save', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save();
        let release;
        f.view.savePromise = new Promise(resolve => { release = resolve; });
        const completion = f.complete(); await wait(20);
        const tasks = []; f.callbacks.get('workspace:quit')({ add: fn => tasks.push(fn()) });
        const pending = f.view.savePromise; f.view.savePromise = null; release(); await pending;
        await Promise.all([completion, ...tasks]); assert.equal(f.writes(), 0); assert.equal(f.saves(), 1);
    });
});

test('quit between processFrontMatter scheduling and callback prevents metadata mutation', async () => {
    await fixture(async f => {
        f.edit(); await f.view.save(); const saved = f.disk();
        const process = f.app.fileManager.processFrontMatter;
        let entered, release;
        const scheduled = new Promise(resolve => { entered = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        f.app.fileManager.processFrontMatter = async (...args) => { entered(); await gate; return process(...args); };
        const completion = f.complete(); await scheduled;
        const tasks = []; f.callbacks.get('workspace:quit')({ add: fn => tasks.push(fn()) });
        release(); await Promise.all([completion, ...tasks]);
        assert.equal(f.disk(), saved); assert.equal(f.writes(), 0); assert.equal(f.pending().length, 1);
    });
});

test('desktop quit waits for native tasks and metadata persistence before allowing exit, without saving twice', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        f.edit();
        let releaseNative, releaseMetadata, metadataEntered;
        const nativeGate = new Promise(resolve => { releaseNative = resolve; });
        const metadataGate = new Promise(resolve => { releaseMetadata = resolve; });
        const entered = new Promise(resolve => { metadataEntered = resolve; });
        const process = f.app.fileManager.processFrontMatter;
        f.app.fileManager.processFrontMatter = async (...args) => {
            metadataEntered(); await metadataGate; return process(...args);
        };
        const tasks = new QuitTasks();
        tasks.addPromise(nativeGate.then(() => f.view.save())); // Core handler precedes plugin handler.
        f.callbacks.get('workspace:quit')(tasks);
        let exited = false;
        const exit = tasks.promise().then(() => { exited = true; });
        await wait(20); assert.equal(exited, false); assert.equal(f.writes(), 0); assert.equal(f.saves(), 0);
        releaseNative(); await entered;
        assert.equal(exited, false, 'quit remains blocked until metadata is persisted');
        assert.equal(f.saves(), 1); assert.equal(f.writes(), 0);
        releaseMetadata(); await exit;
        assert.equal(f.writes(), 1); assert.equal(f.saves(), 1); assert.equal(f.pending().length, 0);
        assert.equal(JSON.parse(info(f.disk()).frontmatter).revision, 2);
        assert.ok(f.disk().endsWith('edited body must survive'));
        await f.end(); f.start(); await wait(60); assert.equal(f.writes(), 1, 'restart does not double count');
    });
});

test('desktop quit skips cleared views, retains recovery and never calls view.save', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        f.edit(); await f.view.save(); const saved = f.disk(); f.clearMode();
        const tasks = new QuitTasks(); f.callbacks.get('workspace:quit')(tasks); await tasks.promise();
        assert.equal(f.disk(), saved); assert.equal(f.writes(), 0); assert.equal(f.saves(), 1);
        assert.equal(f.pending().length, 1);
    });
});

test('a rejected native quit save leaves metadata pending and does not hang the plugin task', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        f.edit();
        const saved = f.disk(), tasks = new QuitTasks();
        const originalError = console.error;
        try {
            console.error = () => {};
            tasks.addPromise(Promise.reject(new Error('synthetic native write failure')));
            f.callbacks.get('workspace:quit')(tasks);
            await assert.rejects(tasks.promise(), /synthetic native write failure/);
            await Promise.allSettled(tasks.promises);
        } finally { console.error = originalError; }
        assert.equal(f.disk(), saved); assert.equal(f.writes(), 0); assert.equal(f.pending().length, 1);
    });
});

test('plugin unload while desktop quit waits cancels metadata completion', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        f.edit(); await f.view.save(); const saved = f.disk();
        let release;
        const tasks = new QuitTasks(); tasks.addPromise(new Promise(resolve => { release = resolve; }));
        f.callbacks.get('workspace:quit')(tasks);
        await f.end(); release(); await tasks.promise();
        assert.equal(f.disk(), saved); assert.equal(f.writes(), 0);
    });
});

test('duplicate desktop quit events join the same completion task without incrementing twice', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        f.edit(); await f.view.save();
        const tasks = new QuitTasks();
        f.callbacks.get('workspace:quit')(tasks); f.callbacks.get('workspace:quit')(tasks);
        await tasks.promise(); assert.equal(f.writes(), 1); assert.equal(f.saves(), 1);
    });
});

test('desktop quit completes multiple native-saved notes, including Properties changes', async () => {
    await fixture(async f => {
        f.api.Platform.isMobile = false;
        const otherFile = { path: 'notes/other.md', stat: { mtime: 1730000000000 } };
        let otherDisk = note('other body'), otherBuffer = otherDisk, otherWrites = 0;
        const otherView = { file: otherFile, dirty: false, editor: { getValue: () => otherBuffer }, getViewData: () => otherBuffer };
        const lookup = f.app.vault.getAbstractFileByPath, read = f.app.vault.read;
        const process = f.app.fileManager.processFrontMatter;
        f.app.workspace.iterateAllLeaves = fn => { fn({ view: f.view }); fn({ view: otherView }); };
        f.app.vault.getAbstractFileByPath = path => path === otherFile.path ? otherFile : lookup(path);
        f.app.vault.read = file => file === otherFile ? Promise.resolve(otherDisk) : read(file);
        f.app.fileManager.processFrontMatter = async (file, update) => {
            if (file !== otherFile) return process(file, update);
            const metadata = JSON.parse(info(otherDisk).frontmatter); update(metadata); otherWrites++;
            otherDisk = otherBuffer = `---\n${JSON.stringify(metadata)}\n---\n${otherDisk.slice(info(otherDisk).contentStart)}`;
        };
        await f.callbacks.get('vault:modify')(otherFile); // Establish a known baseline.
        f.edit();
        const tasks = new QuitTasks();
        tasks.addPromise(Promise.resolve().then(async () => {
            await f.view.save();
            otherDisk = otherBuffer = otherDisk.replace('"revision":1', '"revision":1,"tags":["property-edit"]');
            otherFile.stat.mtime += 1000;
            await f.callbacks.get('vault:modify')(otherFile);
        }));
        f.callbacks.get('workspace:quit')(tasks); await tasks.promise();
        assert.equal(f.writes(), 1); assert.equal(otherWrites, 1); assert.equal(f.pending().length, 0);
        assert.equal(JSON.parse(info(otherDisk).frontmatter).revision, 2);
        assert.deepEqual(JSON.parse(info(otherDisk).frontmatter).tags, ['property-edit']);
        assert.ok(otherDisk.endsWith('other body')); assert.equal(f.saves(), 1);
    });
});
