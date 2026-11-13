import { propertyNames, revisionEnabled } from './properties.mjs';

export function comparableContent(text, api, comparisonVersion = 2, overrides = {}) {
    text = text.replace(/\r\n?/g, '\n');
    const info = api.getFrontMatterInfo(text);
    const properties = info.exists ? (api.parseYaml(info.frontmatter) ?? {}) : {};
    if (typeof properties !== 'object' || Array.isArray(properties))
        throw new Error('Frontmatter must be a mapping');
    const stable = (value) => {
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(stable);
        if (value && typeof value === 'object')
            return Object.fromEntries(
                Object.keys(value)
                    .sort()
                    .map((key) => [key, stable(value[key])]),
            );
        return value;
    };
    const names = propertyNames(api);
    const relevant = Object.fromEntries(
        Object.entries({ ...properties, ...overrides }).filter(
            ([key]) =>
                key !== names.updated &&
                !(revisionEnabled(api) && key === names.revision) &&
                !(comparisonVersion === 1 && key === names.created),
        ),
    );
    return (
        JSON.stringify(stable(relevant)) +
        '\n' +
        (info.exists ? text.slice(info.contentStart) : text)
    );
}

export function metadataOf(text, api) {
    const info = api.getFrontMatterInfo(text);
    const fm = info.exists ? (api.parseYaml(info.frontmatter) ?? {}) : {};
    const names = propertyNames(api);
    const count = revisionEnabled(api) ? (fm[names.revision] ?? 0) : 0;
    if (!Number.isSafeInteger(count) || count < 0)
        throw new Error(`${names.revision} must be a non-negative integer`);
    return {
        count,
        updated:
            fm[names.updated] instanceof Date
                ? fm[names.updated].toISOString()
                : (fm[names.updated] ?? null),
        hasCreated: Object.hasOwn(fm, names.created),
        created:
            fm[names.created] instanceof Date
                ? fm[names.created].toISOString()
                : (fm[names.created] ?? null),
    };
}

export async function sha256(text) {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
