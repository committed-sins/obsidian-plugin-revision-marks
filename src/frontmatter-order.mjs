import { DEFAULT_PROPERTIES } from './properties.mjs';

// Only add a missing session-field block. Never globally sort an existing note.
export function addSessionProperties(
    frontmatter,
    values,
    properties = DEFAULT_PROPERTIES,
    revisionMode = 'counter',
)
{
    const managed = [
        properties.created,
        properties.updated,
        ...(revisionMode === 'off' ? [] : [properties.revision]),
    ];
    const originalKeys = Object.keys(frontmatter);
    const missing = managed.filter((key) => !Object.hasOwn(frontmatter, key));
    const existing = originalKeys.filter((key) => managed.includes(key));
    const entries = originalKeys.map((key) => [
        key,
        Object.hasOwn(values, key) ? values[key] : frontmatter[key],
    ]);
    if (missing.length === 0) {
        for (const key of managed) if (Object.hasOwn(values, key)) frontmatter[key] = values[key];
        return;
    }
    const block = managed.map((key) => [
        key,
        Object.hasOwn(values, key) ? values[key] : frontmatter[key],
    ]);
    const anchor = existing.length ? originalKeys.indexOf(existing[0]) : originalKeys.length;
    const before = entries.slice(0, anchor).filter(([key]) => !managed.includes(key));
    const after = entries.slice(anchor).filter(([key]) => !managed.includes(key));
    // Reposition only enabled session properties when completing a partial block.
    // Unrelated properties keep their relative order and values.
    for (const key of originalKeys) delete frontmatter[key];
    for (const [key, value] of [...before, ...block, ...after]) {
        Object.defineProperty(frontmatter, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    }
}
