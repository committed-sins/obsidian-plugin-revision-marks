import assert from 'node:assert/strict';
import test from 'node:test';
import { addSessionProperties } from '../src/frontmatter-order.mjs';

test('completing a partial block preserves unrelated values and unusual own property names safely', () =>
{
    const fm = JSON.parse('{"custom":{"nested":true},"__proto__":"keep","revision":2,"id":"same"}');
    addSessionProperties(fm, { created: 'now', updated: 'now', revision: 3 });
    assert.deepEqual(Object.keys(fm), [
        'custom',
        '__proto__',
        'created',
        'updated',
        'revision',
        'id',
    ]);
    assert.equal(Object.getPrototypeOf(fm), Object.prototype);
    assert.equal(fm.__proto__, 'keep');
    assert.deepEqual(fm.custom, { nested: true });
});

test('all missing-field combinations form a single created/updated/revision block at the first existing field or bottom', () =>
{
    const keys = ['created', 'updated', 'revision'];
    const values = { created: 'creation', updated: 'update', revision: 5 };
    for (let mask = 0; mask < 7; mask++) {
        const fm = { id: 'stable', title: 'keep' };
        for (let index = 2; index >= 0; index--)
            if (mask & (1 << index)) {
                fm[keys[index]] = values[keys[index]];
                fm['custom_' + index] = { value: index };
            }
        fm.tail = true;
        const unrelated = Object.keys(fm).filter((key) => !keys.includes(key));
        addSessionProperties(fm, values);
        const actual = Object.keys(fm);
        assert.deepEqual(
            actual.filter((key) => !keys.includes(key)),
            unrelated,
        );
        assert.deepEqual(
            actual.slice(actual.indexOf('created'), actual.indexOf('created') + 3),
            keys,
        );
        if (mask === 0)
            assert.deepEqual(actual.slice(-3), keys, 'no existing field: append to bottom');
        else
            assert.equal(
                actual.indexOf('created'),
                2,
                'insert at the first existing session field',
            );
    }
});

test('a complete manually reordered or separated block retains its exact key positions', () =>
{
    const fm = {
        revision: 2,
        title: 'keep',
        updated: 'old',
        custom: true,
        created: 'original',
        tail: 3,
    };
    const before = Object.keys(fm);
    addSessionProperties(fm, { created: 'original', updated: 'new', revision: 3 });
    assert.deepEqual(Object.keys(fm), before);
    assert.equal(fm.created, 'original');
    assert.equal(fm.updated, 'new');
    assert.equal(fm.revision, 3);
});
