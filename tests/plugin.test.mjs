import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createPluginClass } from '../src/plugin.mjs';
import { normalizeSettings } from '../src/settings.mjs';
import { addSessionProperties } from '../src/frontmatter-order.mjs';

function fixture(data = {}) {
    const events = [], notices = [], commands = [];
    let ready;
    class Plugin {
        app = { workspace: { onLayoutReady: callback => { ready = callback; }, getActiveFile: () => ({ path: 'notes/Example.md' }) } };
        async loadData() { return data; }
        async saveData(value) { events.push(['save-settings', value]); }
        addCommand(command) { commands.push(command); }
        addSettingTab() {}
    }
    const api = {
        Plugin, PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
        Notice: class { constructor(message) { notices.push(message); } },
        moment: () => ({ format: pattern => pattern })
    };
    const start = (app, runtimeApi) => {
        events.push(['start', runtimeApi]);
        const stop = async () => { events.push(['stop']); };
        stop.complete = path => { events.push(['complete', path]); };
        return stop;
    };
    const PluginClass = createPluginClass(api, start);
    const plugin = new PluginClass();
    return { plugin, events, notices, commands, ready: async () => { ready(); await plugin.restartQueue; } };
}

test('standalone lifecycle waits for layout, supplies its own owner, and completes through commands', async () => {
    const f = fixture();
    await f.plugin.onload(); assert.equal(f.events.length, 0);
    await f.ready();
    assert.equal(f.events[0][0], 'start'); assert.equal(f.events[0][1].owner, f.plugin);
    assert.deepEqual(f.events[0][1].properties, { created: 'created', updated: 'updated', revision: 'revision' });
    const current = f.commands.find(command => command.id === 'complete-current-session');
    assert.equal(current.checkCallback(true), true); assert.equal(f.events.length, 1);
    current.checkCallback(false); assert.deepEqual(f.events.at(-1), ['complete', 'notes/Example.md']);
    f.commands.find(command => command.id === 'complete-all-sessions').callback();
    assert.deepEqual(f.events.at(-1), ['complete', undefined]);
    await f.plugin.onunload(); assert.deepEqual(f.events.at(-1), ['stop']);
});

test('settings apply completes the old runtime before saving and starting the new rules', async () => {
    const f = fixture(); await f.plugin.onload(); await f.ready();
    await f.plugin.applySettings({ excludedFolders: ['private'], properties: { created: 'born', updated: 'touched', revision: 'updated_revision' } });
    assert.deepEqual(f.events.map(event => event[0]), ['start', 'stop', 'save-settings', 'start']);
    assert.deepEqual(f.events.at(-1)[1].excludedFolders, ['private']);
    assert.deepEqual(f.events.at(-1)[1].properties, { created: 'born', updated: 'touched', revision: 'updated_revision' });
    await f.plugin.onunload();
});

test('unloading before layout does not start a late writer', async () => {
    const f = fixture(); await f.plugin.onload(); await f.plugin.onunload(); await f.ready();
    assert.equal(f.events.length, 0);
});

test('invalid settings fail without starting or overwriting recovery state', async () => {
    const f = fixture({ excludedFolders: ['../other-vault'] });
    await assert.rejects(f.plugin.onload(), /relative vault folders/);
    assert.equal(f.events.length, 0); assert.equal(f.notices.length, 1);
    assert.deepEqual(normalizeSettings({ excludedFolders: [] }).excludedFolders, []);
    assert.deepEqual(normalizeSettings().properties, { created: 'created', updated: 'updated', revision: 'revision' });
    assert.throws(() => normalizeSettings({ properties: { created: '' } }), /non-empty/);
    assert.throws(() => normalizeSettings({ properties: { created: 'same', updated: 'same' } }), /distinct/);
    assert.throws(() => normalizeSettings({ properties: { revision: '__proto__' } }), /non-empty/);
});

test('completing a partial block preserves unrelated values and unusual own property names safely', () => {
    const fm = JSON.parse('{"custom":{"nested":true},"__proto__":"keep","revision":2,"id":"same"}');
    addSessionProperties(fm, { created: 'now', updated: 'now', revision: 3 });
    assert.deepEqual(Object.keys(fm), ['custom', '__proto__', 'created', 'updated', 'revision', 'id']);
    assert.equal(Object.getPrototypeOf(fm), Object.prototype); assert.equal(fm.__proto__, 'keep');
    assert.deepEqual(fm.custom, { nested: true });
});

test('all missing-field combinations form a single created/updated/revision block at the first existing field or bottom', () => {
    const keys = ['created', 'updated', 'revision'];
    const values = { created: 'creation', updated: 'update', revision: 5 };
    for (let mask = 0; mask < 7; mask++) {
        const fm = { id: 'stable', title: 'keep' };
        for (let index = 2; index >= 0; index--) if (mask & (1 << index)) {
            fm[keys[index]] = values[keys[index]];
            fm['custom_' + index] = { value: index };
        }
        fm.tail = true;
        const unrelated = Object.keys(fm).filter(key => !keys.includes(key));
        addSessionProperties(fm, values);
        const actual = Object.keys(fm);
        assert.deepEqual(actual.filter(key => !keys.includes(key)), unrelated);
        assert.deepEqual(actual.slice(actual.indexOf('created'), actual.indexOf('created') + 3), keys);
        if (mask === 0) assert.deepEqual(actual.slice(-3), keys, 'no existing field: append to bottom');
        else assert.equal(actual.indexOf('created'), 2, 'insert at the first existing session field');
    }
});

test('a complete manually reordered or separated block retains its exact key positions', () => {
    const fm = { revision: 2, title: 'keep', updated: 'old', custom: true, created: 'original', tail: 3 };
    const before = Object.keys(fm);
    addSessionProperties(fm, { created: 'original', updated: 'new', revision: 3 });
    assert.deepEqual(Object.keys(fm), before); assert.equal(fm.created, 'original');
    assert.equal(fm.updated, 'new'); assert.equal(fm.revision, 3);
});

test('changing property names is refused while failed old sessions remain, and tracking resumes under old names', async () => {
    const f = fixture(); await f.plugin.onload(); await f.ready();
    f.plugin.runtime.pendingPaths = () => ['notes/Unfinished.md'];
    await assert.rejects(f.plugin.applySettings({ properties: { revision: 'updated_revision' } }), /Pending sessions remain/);
    assert.equal(f.plugin.settings.properties.revision, 'revision');
    assert.deepEqual(f.events.map(event => event[0]), ['start', 'stop', 'start']);
    await f.plugin.onunload();
});

test('built entry exports an Obsidian plugin with only Obsidian/CodeMirror runtime dependencies', () => {
    const requireCalls = [];
    const api = { Plugin: class {}, PluginSettingTab: class {} };
    const module = { exports: {} };
    runInNewContext(readFileSync(new URL('../dist/main.js', import.meta.url), 'utf8'), {
        module, exports: module.exports,
        require: name => {
            requireCalls.push(name);
            if (name === 'obsidian') return api;
            if (name === '@codemirror/view') return { EditorView: {} };
            throw new Error('Unexpected dependency: ' + name);
        }
    });
    assert.equal(typeof module.exports.default, 'function');
    assert.ok(new module.exports.default() instanceof api.Plugin);
    assert.deepEqual([...new Set(requireCalls)].sort(), ['@codemirror/view', 'obsidian']);
});
