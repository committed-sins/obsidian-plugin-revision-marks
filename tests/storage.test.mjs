import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSessionStorage, sessionStorageKey } from '../src/storage.mjs';

const defaults = { created: 'created', updated: 'updated', revision: 'revision' };
const legacy = { ...defaults, revision: 'updated_count' };
const fixture = () =>
{
    const values = new Map();
    return {
        values,
        storage: {
            getItem: (key) => values.get(key),
            setItem: (key, value) => values.set(key, value),
        },
    };
};

test('property-name mappings have separate recovery namespaces', () =>
{
    assert.ok(sessionStorageKey('vault', defaults).startsWith('revision-marks.v2:'));
    assert.notEqual(sessionStorageKey('vault', defaults), sessionStorageKey('vault', legacy));
    assert.notEqual(
        sessionStorageKey('vault', defaults),
        sessionStorageKey('other-vault', defaults),
    );
});

test('timestamp-only state is separate and cannot import pending counter intentions', () =>
{
    const f = fixture();
    const counter = sessionStorageKey('vault', defaults),
        off = sessionStorageKey('vault', defaults, 'off');
    assert.notEqual(off, counter);
    f.values.set(counter, 'pending counter journal');
    f.values.set(counter.replace('revision-marks.v2:', 'session-marks.v2:'), 'old counter journal');
    assert.equal(prepareSessionStorage(f.storage, 'vault', defaults, 'off'), off);
    assert.equal(f.values.has(off), false);
    assert.equal(f.values.get(counter), 'pending counter journal');
});

test('renaming copies the exact property-mapped Session Marks journal and baselines, retaining originals', () =>
{
    const f = fixture();
    const names = { created: 'born', updated: 'touched', revision: 'updated_revision' };
    const key = sessionStorageKey('vault', names),
        old = key.replace('revision-marks.v2:', 'session-marks.v2:');
    const journal = JSON.stringify({
        version: 1,
        entries: [{ path: 'A.md', intent: { count: 6 } }],
    });
    const baselines = JSON.stringify({ version: 2, entries: [['A.md', { count: 5 }]] });
    f.values.set(old, journal);
    f.values.set(old + ':baselines', baselines);
    assert.equal(prepareSessionStorage(f.storage, 'vault', names), key);
    assert.equal(f.values.get(key), journal);
    assert.equal(f.values.get(key + ':baselines'), baselines);
    assert.equal(f.values.get(old), journal);
    assert.equal(f.values.get(old + ':baselines'), baselines);
    f.values.set(key, '{"version":1,"entries":[]}');
    f.values.set(key + ':baselines', 'new baselines');
    prepareSessionStorage(f.storage, 'vault', names);
    assert.equal(f.values.get(key), '{"version":1,"entries":[]}');
    assert.equal(f.values.get(key + ':baselines'), 'new baselines');
    assert.equal(f.values.has(sessionStorageKey('other-vault', names)), false);
});

test('an interrupted rename copy retries without losing the source journal', () =>
{
    const f = fixture(),
        key = sessionStorageKey('vault', defaults);
    const old = key.replace('revision-marks.v2:', 'session-marks.v2:');
    f.values.set(old, 'retained journal');
    f.values.set(old + ':baselines', 'retained baselines');
    const setItem = f.storage.setItem;
    f.storage.setItem = (name, value) =>
    {
        if (name === key) throw new Error('synthetic full storage');
        setItem(name, value);
    };
    assert.throws(() => prepareSessionStorage(f.storage, 'vault', defaults), /full storage/);
    assert.equal(f.values.has(key), false);
    assert.equal(f.values.get(old), 'retained journal');
    f.storage.setItem = setItem;
    prepareSessionStorage(f.storage, 'vault', defaults);
    assert.equal(f.values.get(key), 'retained journal');
    assert.equal(f.values.get(key + ':baselines'), 'retained baselines');
});

test('unfinished previous-preview sessions cannot be interpreted as revision counts', () =>
{
    const f = fixture();
    const raw = JSON.stringify({ version: 1, entries: [{ path: 'A.md' }] });
    f.values.set('session-marks.v1:vault', raw);
    assert.throws(() => prepareSessionStorage(f.storage, 'vault', defaults), /updated_count first/);
    assert.equal(f.values.get('session-marks.v1:vault'), raw);
    assert.equal(f.values.has(sessionStorageKey('vault', defaults)), false);
});

test('the exact legacy mapping copies pending state once, retaining originals', () =>
{
    const f = fixture();
    const raw = JSON.stringify({ version: 1, entries: [{ path: 'A.md' }] });
    f.values.set('session-marks.v1:vault', raw);
    f.values.set('session-marks.v1:vault:baselines', 'baseline');
    const key = prepareSessionStorage(f.storage, 'vault', legacy);
    assert.equal(f.values.get(key), raw);
    assert.equal(f.values.get(key + ':baselines'), 'baseline');
    assert.equal(f.values.get('session-marks.v1:vault'), raw);
    f.values.set(key, JSON.stringify({ version: 1, entries: [] }));
    prepareSessionStorage(f.storage, 'vault', legacy);
    assert.deepEqual(JSON.parse(f.values.get(key)).entries, []);
    assert.equal(
        prepareSessionStorage(f.storage, 'vault', defaults),
        sessionStorageKey('vault', defaults),
    );
});
