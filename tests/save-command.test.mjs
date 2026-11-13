import assert from 'node:assert/strict';
import test from 'node:test';
import { registerSaveCommand } from '../src/save-command.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('save-command adapter preserves binding, arguments and return identity without completing availability checks', async () =>
{
    const returned = {},
        argumentsSeen = [],
        completed = [],
        errors = [];
    const command = {
        checkCallback(...args)
        {
            assert.equal(this, command);
            argumentsSeen.push(args);
            return returned;
        },
    };
    const original = command.checkCallback;
    const app = {
        commands: { commands: { 'editor:save-file': command } },
        workspace: { getActiveFile: () => ({ path: 'A.md' }) },
    };
    const restore = registerSaveCommand({
        app,
        complete: (path) => completed.push(path),
        isStopped: () => false,
        report: (error) => errors.push(error),
    });

    assert.equal(command.checkCallback(true, 'context'), returned);
    await settle();
    assert.deepEqual(completed, []);
    assert.equal(command.checkCallback(false, 'context'), returned);
    await settle();
    assert.deepEqual(completed, ['A.md']);
    assert.deepEqual(argumentsSeen, [
        [true, 'context'],
        [false, 'context'],
    ]);
    assert.deepEqual(errors, []);
    restore();
    assert.equal(command.checkCallback, original);
});

test('save-command adapter reports native promise failures and never restores over a later callback owner', async () =>
{
    const failure = new Error('native save failed'),
        completed = [],
        errors = [];
    const promise = Promise.reject(failure);
    const command = { callback: () => promise };
    const app = {
        commands: { commands: { 'editor:save-file': command } },
        workspace: { getActiveFile: () => ({ path: 'A.md' }) },
    };
    const restore = registerSaveCommand({
        app,
        complete: (path) => completed.push(path),
        isStopped: () => false,
        report: (error) => errors.push(error),
    });
    assert.equal(command.callback(), promise);
    await settle();
    assert.deepEqual(errors, [failure]);
    assert.deepEqual(completed, []);
    const replacement = () => 'other owner';
    command.callback = replacement;
    restore();
    assert.equal(command.callback, replacement);
});

test('missing native save command produces a notice path and a safe cleanup function', () =>
{
    const errors = [];
    const restore = registerSaveCommand({
        app: {},
        complete()
        {},
        isStopped: () => false,
        report: (error) => errors.push(error),
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Ctrl\+S session completion is unavailable/);
    assert.doesNotThrow(restore);
});
