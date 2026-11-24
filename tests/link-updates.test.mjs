import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createLinkUpdateClassifier } from '../src/link-updates.mjs';
import { createSessionTracker } from '../src/session-tracker.mjs';

const hash = async (value) => createHash('sha256').update(value).digest('hex');
const api = {
    countLinkUpdates: false,
    getFrontMatterInfo(text)
    {
        const match = text.match(/^---\n([\s\S]*?)\n---\n/);
        return match ?
            { exists: true, frontmatter: match[1], contentStart: match[0].length } :
            { exists: false };
    },
    parseYaml: JSON.parse,
    formatDate: (value) => value,
};
const metadata = { created: '2020-01-01', updated: '2020-01-01', revision: 4 };
const note = (body, fm = metadata) => `---\n${JSON.stringify(fm)}\n---\n${body}`;

function fixture()
{
    const source = { path: 'notes/Source.md' },
        target = { path: 'docs/Old.md' },
        other = { path: 'docs/Other.md' };
    const files = new Map([source, target, other].map((file) => [file.path, file]));
    const contents = new Map(), caches = new Map(), stored = new Map(), errors = [], writes = [];
    let clock = 100;
    const app = {
        vault: { getAbstractFileByPath: (name) => files.get(name) },
        metadataCache: {
            resolvedLinks: { [source.path]: { [target.path]: 1 } },
            getFileCache: (file) => caches.get(file.path),
            getFirstLinkpathDest(link, sourcePath)
            {
                link = decodeURIComponent(link.split('#')[0]);
                const candidates = [
                    link,
                    path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), link)),
                ];
                for (const name of candidates) {
                    if (files.has(name)) return files.get(name);
                    if (files.has(name + '.md')) return files.get(name + '.md');
                }
                return [...files.values()].find((file) =>
                    path.posix.basename(file.path, '.md') === link
                ) ?? null;
            },
        },
    };
    const classifier = createLinkUpdateClassifier({ app, api, hash, now: () => clock });
    const options = {
        api,
        hash,
        storageKey: 'links',
        storage: {
            getItem: (key) => stored.get(key),
            setItem: (key, value) => stored.set(key, value),
        },
        exists: (name) => files.has(name),
        read: async (name) => ({ text: contents.get(name), mtime: 1794398400000 }),
        write: async (name, intent) =>
        {
            const text = contents.get(name), info = api.getFrontMatterInfo(text);
            const fm = JSON.parse(info.frontmatter);
            contents.set(
                name,
                note(text.slice(info.contentStart), {
                    ...fm,
                    updated: intent.updated,
                    ...(!intent.preserveRevision ? { revision: intent.count } : {}),
                }),
            );
            writes.push(name);
        },
        report: (error) => errors.push(error),
        linkFingerprint: classifier.fingerprint,
        matchesLinkUpdate: classifier.matches,
    };
    const tracker = createSessionTracker(options);
    function set(text, references, frontmatterLinks = [])
    {
        contents.set(source.path, text);
        caches.set(source.path, {
            links: references.filter((ref) => !ref.embed).map(reference),
            embeds: references.filter((ref) => ref.embed).map(reference),
            frontmatterLinks,
        });
        function reference({ original, link })
        {
            const start = text.indexOf(original);
            assert.notEqual(start, -1);
            return {
                original,
                link,
                position: { start: { offset: start }, end: { offset: start + original.length } },
            };
        }
    }
    function rename(newPath = 'docs/New.md')
    {
        const oldPath = target.path;
        files.delete(oldPath);
        target.path = newPath;
        files.set(newPath, target);
        classifier.rename(target, oldPath);
    }
    return {
        source,
        target,
        app,
        contents,
        classifier,
        tracker,
        options,
        errors,
        writes,
        stored,
        set,
        rename,
        expire: () =>
        {
            clock += 60001;
        },
    };
}

test('known wiki, aliased, embedded and Markdown link rewrites update timestamps only without storing note text', async () =>
{
    const variants = [
        ['[[Old]]', 'Old', '[[New]]', 'New'],
        ['[[Old#Heading|Label]]', 'Old#Heading', '[[New#Heading|Label]]', 'New#Heading'],
        ['![[Old]]', 'Old', '![[New]]', 'New', true],
        [
            '[Label](../docs/Old.md#Heading)',
            '../docs/Old.md#Heading',
            '[Label](../docs/New.md#Heading)',
            '../docs/New.md#Heading',
        ],
    ];
    for (const [before, oldLink, after, newLink, embed] of variants) {
        const f = fixture();
        f.set(note('Link: ' + before), [{ original: before, link: oldLink, embed }]);
        await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
        f.rename();
        f.set(note('Link: ' + after), [{ original: after, link: newLink, embed }]);
        await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 2, {
            linkUpdate: true,
        });
        await f.tracker.finish(f.source.path, { force: true });
        assert.equal(f.writes.length, 1);
        assert.equal(
            JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
            4,
        );
        assert.notEqual(
            JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).updated,
            metadata.updated,
        );
        assert.deepEqual(f.tracker.paths(), []);
        assert.deepEqual(f.errors, []);
        await f.tracker.checkpoint();
        assert.ok(!JSON.stringify([...f.stored]).includes('Link:'));
        assert.ok(!JSON.stringify([...f.stored]).includes('docs/New.md'));
    }
});

test('additional prose, Properties, aliases and unrelated target changes still count', async () =>
{
    for (const kind of ['prose', 'property', 'alias', 'target', 'default-on', 'expired']) {
        const f = fixture();
        if (kind === 'default-on') f.options.api = { ...api, countLinkUpdates: true };
        const tracker = createSessionTracker(f.options);
        f.set(note('Link: [[Old|Label]]'), [{ original: '[[Old|Label]]', link: 'Old' }]);
        await tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
        f.rename();
        if (kind === 'expired') f.expire();
        const token = kind === 'target' ?
            '[[Other|Label]]' :
            kind === 'alias' ?
            '[[New|Changed]]' :
            '[[New|Label]]';
        f.set(
            note(
                'Link: ' + token + (kind === 'prose' ? ' changed' : ''),
                kind === 'property' ? { ...metadata, tags: ['changed'] } : metadata,
            ),
            [{ original: token, link: kind === 'target' ? 'Other' : 'New' }],
        );
        await tracker.observe(f.source.path, f.contents.get(f.source.path), 2, {
            linkUpdate: true,
        });
        await tracker.finish(f.source.path, { force: true });
        assert.equal(f.writes.length, 1, kind);
        assert.equal(
            JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
            5,
        );
        assert.deepEqual(f.errors, []);
    }
});

test('frontmatter links and successive renames retain exact target attribution', async () =>
{
    const f = fixture();
    f.set(
        note('Body', { ...metadata, related: '[[Old]]' }),
        [],
        [{ original: '[[Old]]', link: 'Old' }],
    );
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
    f.rename();
    f.app.metadataCache.resolvedLinks[f.source.path] = { [f.target.path]: 1 };
    f.rename('moved/Final.md');
    f.set(
        note('Body', { ...metadata, related: '[[Final]]' }),
        [],
        [{ original: '[[Final]]', link: 'Final' }],
    );
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 2, { linkUpdate: true });
    await f.tracker.finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.equal(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
        4,
    );
    assert.notEqual(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).updated,
        metadata.updated,
    );
    assert.deepEqual(f.errors, []);
});

test('missing/stale metadata and unknown before-images never suppress a revision', async () =>
{
    const f = fixture();
    f.set(note('[[Old]]'), [{ original: '[[Old]]', link: 'Old' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
    f.rename();
    const after = note('[[New]]');
    assert.equal(f.classifier.ready(f.source.path, after), false);
    f.contents.set(f.source.path, after);
    await f.tracker.observe(f.source.path, after, 2, { linkUpdate: true });
    await f.tracker.finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
});

test('folder renames are recognized in other notes without relying on basename matching', async () =>
{
    const f = fixture();
    f.set(note('[[docs/Old]]'), [{ original: '[[docs/Old]]', link: 'docs/Old' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
    // The folder event itself has no extension. Children already have their new paths.
    f.target.path = 'moved/Old.md';
    f.app.metadataCache.getFirstLinkpathDest = (link) =>
        link + '.md' === f.target.path ? f.target : null;
    f.app.vault.getAbstractFileByPath = (name) =>
        name === f.source.path ? f.source : name === f.target.path ? f.target : null;
    f.classifier.rename({ path: 'moved' }, 'docs');
    f.set(note('[[moved/Old]]'), [{ original: '[[moved/Old]]', link: 'moved/Old' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 2, { linkUpdate: true });
    await f.tracker.finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.equal(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
        4,
    );
    assert.notEqual(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).updated,
        metadata.updated,
    );
    assert.deepEqual(f.errors, []);
});

test('lost rename context after restart counts conservatively using the saved content baseline', async () =>
{
    const f = fixture();
    f.set(note('[[Old]]'), [{ original: '[[Old]]', link: 'Old' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
    await f.tracker.checkpoint();
    f.rename();
    f.set(note('[[New]]'), [{ original: '[[New]]', link: 'New' }]);
    const classifier = createLinkUpdateClassifier({ app: f.app, api, hash });
    const recovered = createSessionTracker({
        ...f.options,
        linkFingerprint: classifier.fingerprint,
        matchesLinkUpdate: classifier.matches,
    });
    await recovered.observe(f.source.path, f.contents.get(f.source.path), 2, { linkUpdate: true });
    await recovered.finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
});

async function pendingLinkRewrite(f, fm = metadata)
{
    f.set(note('[[Old]]', fm), [{ original: '[[Old]]', link: 'Old' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 1);
    f.rename();
    f.set(note('[[New]]', fm), [{ original: '[[New]]', link: 'New' }]);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 2, { linkUpdate: true });
}

test('timestamp-only link sessions retain policy across duplicate observations and journal recovery', async () =>
{
    const f = fixture();
    await pendingLinkRewrite(f);
    await f.tracker.observe(f.source.path, f.contents.get(f.source.path), 2);
    await f.tracker.checkpoint();
    const recovered = createSessionTracker(f.options);
    await recovered.finish(f.source.path, { force: true });
    const after = JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter);
    assert.equal(after.revision, metadata.revision);
    assert.notEqual(after.updated, metadata.updated);
    await createSessionTracker(f.options).finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
});

test('interruption after timestamp-only link metadata commit never increments on recovery', async () =>
{
    const f = fixture();
    await pendingLinkRewrite(f);
    await f.tracker.checkpoint();
    // Reload the persisted link-only decision, then interrupt after its write.
    const writer = createSessionTracker({
        ...f.options,
        write: async (...args) =>
        {
            await f.options.write(...args);
            throw new Error('simulated interruption after timestamp write');
        },
    });
    await writer.finish(f.source.path, { force: true });
    const recovered = createSessionTracker(f.options);
    await recovered.finish(f.source.path, { force: true });
    assert.equal(f.writes.length, 1);
    assert.equal(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
        4,
    );
    assert.deepEqual(recovered.paths(), []);
});

test('additional genuine edits upgrade a pending link-only session to a counted revision', async () =>
{
    const f = fixture();
    await pendingLinkRewrite(f);
    const before = f.contents.get(f.source.path), after = before + ' meaningful edit';
    f.tracker.change(f.source.path, before, after);
    f.contents.set(f.source.path, after);
    await f.tracker.finish(f.source.path, { force: true });
    assert.equal(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
        5,
    );
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
});

test('timestamp-only link sessions preserve a missing revision property instead of initializing it', async () =>
{
    const f = fixture();
    const fm = { ...metadata };
    delete fm.revision;
    await pendingLinkRewrite(f, fm);
    await f.tracker.finish(f.source.path, { force: true });
    const after = JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter);
    assert.equal(Object.hasOwn(after, 'revision'), false);
    assert.notEqual(after.updated, metadata.updated);
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.errors, []);
});

test('unobserved genuine edits upgrade timestamp-only recovery permanently across a failed normal write', async () =>
{
    const f = fixture();
    await pendingLinkRewrite(f);
    await f.tracker.checkpoint();
    f.contents.set(f.source.path, f.contents.get(f.source.path) + ' real edit before completion');
    const interrupted = createSessionTracker({
        ...f.options,
        write: async () =>
        {
            throw new Error('simulated failure before the upgraded revision is written');
        },
    });
    await interrupted.finish(f.source.path, { force: true });
    const recovered = createSessionTracker(f.options);
    await recovered.finish(f.source.path, { force: true });
    assert.equal(
        JSON.parse(api.getFrontMatterInfo(f.contents.get(f.source.path)).frontmatter).revision,
        5,
    );
    assert.equal(f.writes.length, 1);
});
