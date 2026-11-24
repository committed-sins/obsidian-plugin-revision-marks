import { comparableContent, sha256 } from './note-content.mjs';

/** Attribute link-only edits conservatively, using public metadata and rename events.
 * Store fingerprints only; neither note bodies nor link text enter the journal.
 */
export function createLinkUpdateClassifier({ app, api, hash = sha256, now = Date.now })
{
    const pending = new Map();
    const pathHashes = new Map();
    const under = (path, root) => path === root || path.startsWith(root + '/');
    const pathHash = (path) =>
    {
        if (!pathHashes.has(path)) pathHashes.set(path, hash(path));
        return pathHashes.get(path);
    };
    const project = (reference, sourcePath) =>
    {
        const link = reference.link;
        if (typeof link !== 'string' || typeof reference.original !== 'string') return null;
        if (/^[a-z][a-z\d+.-]*:/i.test(link)) return { replacement: reference.original };
        const target = link.split('#')[0];
        const destination = target ?
            app.metadataCache.getFirstLinkpathDest(target, sourcePath) :
            app.vault.getAbstractFileByPath(sourcePath);
        if (!destination) return null;
        const identity = 'revision-marks-target';
        const targetPath = destination.path;
        const original = reference.original;
        const wiki = original.match(/^(!?\[\[)([\s\S]*?)(\]\])$/);
        if (wiki) {
            const separator = wiki[2].search(/[#|]/);
            return {
                replacement: wiki[1] + identity + (separator < 0 ? '' : wiki[2].slice(separator)) +
                    wiki[3],
                targetPath,
            };
        }
        const start = original.indexOf('](');
        if (start < 0) return null;
        const offset = start + 2 + (original[start + 2] === '<' ? 1 : 0);
        if (original.slice(offset, offset + link.length) !== link) return null;
        const fragment = link.includes('#') ? link.slice(link.indexOf('#')) : '';
        return {
            replacement: original.slice(0, offset) + identity + fragment +
                original.slice(offset + link.length),
            targetPath,
        };
    };
    const normalize = (path, text) =>
    {
        const file = app.vault.getAbstractFileByPath(path);
        const cache = file && app.metadataCache?.getFileCache?.(file);
        if (!cache || !app.metadataCache?.getFirstLinkpathDest) return null;
        const edits = [];
        for (const reference of [...(cache.links ?? []), ...(cache.embeds ?? [])]) {
            const start = reference.position?.start?.offset;
            const end = reference.position?.end?.offset;
            if (
                !Number.isInteger(start) || !Number.isInteger(end) ||
                text.slice(start, end) !== reference.original
            ) return null;
            const projected = project(reference, path);
            if (projected === null) return null;
            edits.push({ start, end, ...projected });
        }
        // Frontmatter links have no offsets. Replace only cached wiki references
        // inside the header, preserving quotes, aliases and all other properties.
        const info = api.getFrontMatterInfo(text);
        if (info.exists && cache.frontmatterLinks?.length) {
            const headerStart = text.indexOf(info.frontmatter);
            if (headerStart < 0) return null;
            const seen = new Set();
            for (const reference of cache.frontmatterLinks) {
                if (seen.has(reference.original)) continue;
                seen.add(reference.original);
                if (!/^\[\[.*\]\]$/.test(reference.original)) return null;
                const projected = project(reference, path);
                if (projected === null) return null;
                let offset = info.frontmatter.indexOf(reference.original);
                if (offset < 0) return null;
                while (offset >= 0) {
                    edits.push({
                        start: headerStart + offset,
                        end: headerStart + offset + reference.original.length,
                        ...projected,
                    });
                    offset = info.frontmatter.indexOf(
                        reference.original,
                        offset + reference.original.length,
                    );
                }
            }
        }
        edits.sort((a, b) => b.start - a.start);
        let limit = text.length;
        for (const { start, end, replacement } of edits) {
            if (start < 0 || end < start || end > limit) return null;
            text = text.slice(0, start) + replacement + text.slice(end);
            limit = start;
        }
        return {
            text,
            targets: edits.filter((edit) => edit.targetPath).reverse().map((edit) =>
                edit.targetPath
            ),
        };
    };
    const isPending = (path) =>
    {
        const context = pending.get(path);
        if (!context) return false;
        if (context.expiry < now()) {
            pending.delete(path);
            return false;
        }
        return true;
    };
    function rename(file, oldPath)
    {
        for (const [path, context] of [...pending]) {
            if (!isPending(path)) continue;
            if (under(path, oldPath)) {
                pending.delete(path);
                pending.set(file.path + path.slice(oldPath.length), context);
            }
        }
        for (
            const [source, destinations] of Object.entries(app.metadataCache?.resolvedLinks ?? {})
        ) {
            if (under(source, oldPath) || under(source, file.path)) continue;
            if (
                Object.keys(destinations).some((target) =>
                    under(target, oldPath) || under(target, file.path)
                )
            ) {
                const context = pending.get(source) ?? { pairs: [], expiry: 0 };
                context.expiry = now() + 60000;
                for (const target of Object.keys(destinations)) {
                    if (under(target, oldPath))
                        context.pairs.push([target, file.path + target.slice(oldPath.length)]);
                    else if (under(target, file.path))
                        context.pairs.push([oldPath + target.slice(file.path.length), target]);
                }
                pending.set(source, context);
            }
        }
    }
    return {
        rename,
        isPending,
        complete: (path) => pending.delete(path),
        ready: (path, text) => normalize(path, text) !== null,
        matches: async (path, before, after) =>
        {
            if (
                !isPending(path) || !before || !after || before.content !== after.content ||
                !Array.isArray(before.targets) || !Array.isArray(after.targets) ||
                before.targets.length !== after.targets.length
            ) return false;
            const pairs = await Promise.all(
                pending.get(path).pairs.map(async (
                    [oldPath, newPath],
                ) => [await pathHash(oldPath), await pathHash(newPath)]),
            );
            return before.targets.every((target, index) =>
            {
                for (const [oldHash, newHash] of pairs) if (target === oldHash) target = newHash;
                return target === after.targets[index];
            });
        },
        fingerprint: async (path, text, overrides = {}) =>
        {
            const normalized = normalize(path, text);
            if (normalized === null) return null;
            return {
                content: await hash(comparableContent(normalized.text, api, 2, overrides)),
                targets: await Promise.all(normalized.targets.map(pathHash)),
            };
        },
    };
}
