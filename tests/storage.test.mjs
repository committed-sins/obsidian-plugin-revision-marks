import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSessionStorage, sessionStorageKey } from '../src/storage.mjs';

const defaults = { created: 'created', updated: 'updated', revision: 'revision' };
const legacy = { ...defaults, revision: 'updated_count' };
const fixture = () => {
    const values = new Map();
    return { values, storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } };
};

test('property-name mappings have separate recovery namespaces', () => {
    assert.notEqual(sessionStorageKey('vault', defaults), sessionStorageKey('vault', legacy));
    assert.notEqual(sessionStorageKey('vault', defaults), sessionStorageKey('other-vault', defaults));
});

test('unfinished previous-preview sessions cannot be interpreted as revision counts', () => {
    const f = fixture(); const raw = JSON.stringify({ version: 1, entries: [{ path: 'A.md' }] });
    f.values.set('session-marks.v1:vault', raw);
    assert.throws(() => prepareSessionStorage(f.storage, 'vault', defaults), /updated_count first/);
    assert.equal(f.values.get('session-marks.v1:vault'), raw);
    assert.equal(f.values.has(sessionStorageKey('vault', defaults)), false);
});

test('the exact legacy mapping copies pending state once, retaining originals', () => {
    const f = fixture(); const raw = JSON.stringify({ version: 1, entries: [{ path: 'A.md' }] });
    f.values.set('session-marks.v1:vault', raw); f.values.set('session-marks.v1:vault:baselines', 'baseline');
    const key = prepareSessionStorage(f.storage, 'vault', legacy);
    assert.equal(f.values.get(key), raw); assert.equal(f.values.get(key + ':baselines'), 'baseline');
    assert.equal(f.values.get('session-marks.v1:vault'), raw);
    f.values.set(key, JSON.stringify({ version: 1, entries: [] }));
    prepareSessionStorage(f.storage, 'vault', legacy);
    assert.deepEqual(JSON.parse(f.values.get(key)).entries, []);
    assert.equal(prepareSessionStorage(f.storage, 'vault', defaults), sessionStorageKey('vault', defaults));
});
