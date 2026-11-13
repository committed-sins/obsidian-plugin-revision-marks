import { propertyNames, revisionEnabled } from './properties.mjs';
import { comparableContent, sha256 } from './note-content.mjs';
import { addSessionProperties } from './frontmatter-order.mjs';

/**
 * Guarded note IO for the Obsidian adapter. Recheck views before metadata writes;
 * native Obsidian code alone is responsible for saving note bodies.
 */
export function createNoteAccess({ app, api, fileAt, viewsFor, writing, assertRunning, deferred }) {
    const names = propertyNames(api);

    // Never call TextFileView.save: its mode may already be cleared during unload,
    // even while editor.getValue() still exposes the previous full document.
    async function waitForNativeSave(path, shutdown = false) {
        assertRunning(shutdown);
        for (const view of viewsFor(path)) {
            while (view.savePromise) {
                await view.savePromise;
                assertRunning(shutdown);
            }
        }
    }

    function checkViews(path, disk, comparisonVersion, shutdown = false) {
        assertRunning(shutdown);
        const compare = (text) =>
            comparisonVersion === undefined
                ? text.replace(/\r\n?/g, '\n')
                : comparableContent(text, api, comparisonVersion);

        for (const view of viewsFor(path)) {
            const unsettled = view.dirty === true || view.savePromise;
            const detached = view.data === null || view.lastSavedData === null;
            const hasViewData = typeof view.getViewData === 'function';
            if (
                unsettled ||
                detached ||
                !hasViewData ||
                compare(view.getViewData()) !== compare(disk) ||
                compare(view.editor.getValue()) !== compare(disk)
            ) {
                throw deferred(
                    `${path} has unsaved, detached or stale view content; completion deferred`,
                );
            }
        }
    }

    async function read(path, { shutdown = false } = {}) {
        await waitForNativeSave(path, shutdown);
        const file = fileAt(path);
        const text = await app.vault.read(file);
        checkViews(path, text, undefined, shutdown);
        return { text, mtime: file.stat?.mtime };
    }

    function checkMetadata(path, frontmatter, expected) {
        const count = revisionEnabled(api) ? (frontmatter[names.revision] ?? 0) : 0;
        const updated =
            frontmatter[names.updated] instanceof Date
                ? frontmatter[names.updated].toISOString()
                : (frontmatter[names.updated] ?? null);
        if (count !== expected.count || updated !== expected.updated) {
            throw new Error(`${path} metadata changed concurrently`);
        }

        const hasCreated = Object.hasOwn(frontmatter, names.created);
        const created =
            frontmatter[names.created] instanceof Date
                ? frontmatter[names.created].toISOString()
                : (frontmatter[names.created] ?? null);
        if (
            hasCreated !== expected.hasCreated ||
            JSON.stringify(created) !== JSON.stringify(expected.created)
        ) {
            throw new Error(`${path} creation metadata changed concurrently`);
        }
    }

    async function write(path, intent, expected, expectedHash, context) {
        assertRunning(context.shutdown);
        if (!context.canWrite()) {
            throw new Error(`${path} changed during session completion; update deferred`);
        }
        const file = fileAt(path);
        const disk = await app.vault.read(file);
        const contentHash = await sha256(comparableContent(disk, api, context.comparisonVersion));
        if (contentHash !== expectedHash) {
            throw new Error(`${path} changed before metadata write; update deferred`);
        }

        const checkBuffers = () =>
            checkViews(path, disk, context.comparisonVersion, context.shutdown);
        checkBuffers();
        writing.add(path);
        try {
            await app.fileManager.processFrontMatter(file, (frontmatter) => {
                if (!context.canWrite()) throw new Error(`${path} changed during metadata write`);
                checkBuffers();
                checkMetadata(path, frontmatter, expected);

                const values = {
                    [names.created]: Object.hasOwn(frontmatter, names.created)
                        ? frontmatter[names.created]
                        : intent.created,
                    [names.updated]:
                        intent.updateTimestamp === false
                            ? frontmatter[names.updated]
                            : intent.updated,
                };
                if (revisionEnabled(api)) values[names.revision] = intent.count;
                addSessionProperties(frontmatter, values, names, api.revisionMode);
            });
        } finally {
            writing.delete(path);
        }
    }

    return { read, write, waitForNativeSave, checkViews };
}
