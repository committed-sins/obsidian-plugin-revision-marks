import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createPluginClass } from '../src/plugin.mjs';
import { normalizeSettings } from '../src/settings.mjs';
import { orderFrontmatter } from '../src/frontmatter-order.mjs';

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
    const current = f.commands.find(command => command.id === 'complete-current-session');
    assert.equal(current.checkCallback(true), true); assert.equal(f.events.length, 1);
    current.checkCallback(false); assert.deepEqual(f.events.at(-1), ['complete', 'notes/Example.md']);
    f.commands.find(command => command.id === 'complete-all-sessions').callback();
    assert.deepEqual(f.events.at(-1), ['complete', undefined]);
    await f.plugin.onunload(); assert.deepEqual(f.events.at(-1), ['stop']);
});

test('settings apply completes the old runtime before saving and starting the new rules', async () => {
    const f = fixture(); await f.plugin.onload(); await f.ready();
    await f.plugin.applySettings({ excludedFolders: ['private'], frontmatterOrder: ['id', 'updated_count', 'updated'] });
    assert.deepEqual(f.events.map(event => event[0]), ['start', 'stop', 'save-settings', 'start']);
    assert.deepEqual(f.events.at(-1)[1].excludedFolders, ['private']);
    const fm = { custom: { keep: true }, updated: 'now', id: 'stable', updated_count: 1 };
    f.events.at(-1)[1].orderFrontmatter(fm);
    assert.deepEqual(Object.keys(fm), ['id', 'updated_count', 'updated', 'custom']);
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
});

test('bundled property ordering retains unknown values and handles unusual own property names safely', () => {
    const fm = JSON.parse('{"custom":{"nested":true},"__proto__":"keep","updated_count":2,"id":"same"}');
    orderFrontmatter(fm);
    assert.deepEqual(Object.keys(fm), ['id', 'updated_count', 'custom', '__proto__']);
    assert.equal(Object.getPrototypeOf(fm), Object.prototype); assert.equal(fm.__proto__, 'keep');
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
