import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentFolderExclusions, createNoteMatcher, eligibleNote } from '../src/note-paths.mjs';
import { attachmentDefaults, normalizeSettings } from '../src/settings.mjs';

test('system/hidden directories and custom vault configuration paths are always protected', () =>
{
    const matches = createNoteMatcher([], 'preferences/config');
    for (
        const path of [
            '.obsidian/Note.md',
            '.trash/Note.md',
            '.git/Note.md',
            'notes/.trash/Note.md',
            'notes/.sync/state.md',
            '.hidden.md',
            'preferences/config/Note.md',
            'preferences/config/plugins/cache/Note.md',
            '/outside.md',
            '../outside.md',
        ]
    ) {
        assert.equal(matches(path), false, path);
    }
    for (
        const path of [
            'Root.md',
            'notes/Note.md',
            'preferences/Note.md',
            'preferences/config-copy/Note.md',
        ]
    ) {
        assert.equal(matches(path), true, path);
    }
});

test('recursive folder exclusions match at every depth and exact folder boundaries', () =>
{
    const matches = createNoteMatcher(['**/_assets/']);
    for (const path of ['_assets/Note.md', 'notes/_assets/Note.md', 'a/b/_assets/deeper/Note.md'])
        assert.equal(matches(path), false, path);
    for (
        const path of [
            'Root.md',
            '_assets.md',
            'notes/_assets-other/Note.md',
            'notes/my_assets/Note.md',
        ]
    ) assert.equal(matches(path), true, path);
    assert.equal(eligibleNote('notes/a/b/_assets/Note.md', ['**/_assets/**']), false);
    assert.equal(
        eligibleNote('notes/_assets/Note.md', ['_assets']),
        true,
        'a plain folder is rooted at vault root',
    );
    assert.equal(eligibleNote('_assets/sub/Note.md', ['_assets']), false);
    assert.equal(eligibleNote('notes/resources/_assets/Note.md', ['**/resources/_assets']), false);
    assert.equal(
        eligibleNote('folder(1)+[meta]!/Note.md', ['folder(1)+[meta]!']),
        false,
        'folder punctuation is literal',
    );
});

test('exclusion normalization supports recursive prefixes, trailing slashes and Windows separators without traversal', () =>
{
    assert.deepEqual(
        normalizeSettings({ excludedFolders: ['**\\_assets\\', '**/_assets/**'] }).excludedFolders,
        ['**/_assets'],
    );
    for (
        const path of [
            '../notes',
            '**/../notes',
            '**/',
            '/absolute',
            'C:/absolute',
            'notes//assets',
            'notes/**/assets',
            '*assets',
        ]
    ) {
        assert.throws(() => normalizeSettings({ excludedFolders: [path] }), /vault-relative/, path);
    }
});

test('attachment defaults distinguish fixed, per-note and note-folder locations', () =>
{
    assert.deepEqual(attachmentFolderExclusions('attachments'), ['attachments']);
    assert.deepEqual(attachmentFolderExclusions('files/assets/'), ['files/assets']);
    assert.deepEqual(attachmentFolderExclusions('./_assets'), ['**/_assets']);
    assert.deepEqual(attachmentFolderExclusions('./resources/assets'), ['**/resources/assets']);
    for (const value of ['', '/', '.', './', undefined])
        assert.deepEqual(attachmentFolderExclusions(value), []);
});

test('optional attachment config is read once from the configured directory and safely tolerates missing config', async () =>
{
    assert.deepEqual(
        await attachmentDefaults({
            configDir: 'settings',
            adapter: {
                read: async (path) =>
                {
                    assert.equal(path, 'settings/app.json');
                    return JSON.stringify({ attachmentFolderPath: './_assets' });
                },
            },
        }),
        ['**/_assets'],
    );
    assert.deepEqual(
        await attachmentDefaults({
            adapter: {
                read: async () =>
                {
                    throw new Error('missing config');
                },
            },
        }),
        null,
    );
    assert.deepEqual(
        await attachmentDefaults({ adapter: { read: async () => '{invalid config' } }),
        null,
    );
    assert.deepEqual(
        await attachmentDefaults({
            adapter: { read: async () => JSON.stringify({ attachmentFolderPath: '/' }) },
        }),
        [],
    );
});

test('file eligibility is strictly limited to lowercase .md files', () =>
{
    const matches = createNoteMatcher([]);
    for (const name of ['note.md', 'notes/multiple.dots.md'])
        assert.equal(matches(name), true, name);
    for (
        const name of [
            'note.MD',
            'note.markdown',
            'note.txt',
            'image.png',
            'drawing.canvas',
            'table.base',
            'note.md.backup',
            'binary.pdf',
            'archive.md/attachment.png',
        ]
    ) assert.equal(matches(name), false, name);
});
