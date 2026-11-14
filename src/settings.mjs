import { DEFAULT_EXCLUDED_FOLDERS } from './note-paths.mjs';
import { DEFAULT_PROPERTIES, normalizeProperties } from './properties.mjs';

export const DEFAULT_SETTINGS = Object.freeze({
    revisionMode: 'counter',
    countRenames: false,
    excludedFolders: DEFAULT_EXCLUDED_FOLDERS,
    properties: DEFAULT_PROPERTIES,
});

export function normalizeSettings(value = {})
{
    const list = (input, fallback) => [
        ...new Set(
            (Array.isArray(input) ? input : fallback)
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    ];
    const excludedFolders = list(value.excludedFolders, DEFAULT_SETTINGS.excludedFolders).map(
        (folder) => folder.replaceAll('\\', '/').replace(/\/+$/, ''),
    );
    if (
        excludedFolders.some(
            (folder) =>
                folder.startsWith('/') ||
                folder.includes(':') ||
                folder.split('/').some((part) => !part || part === '.' || part === '..'),
        )
    ) {
        throw new Error('Excluded folders must be relative vault folders, one per line.');
    }
    const properties = normalizeProperties(value.properties);
    const revisionMode = value.revisionMode ?? DEFAULT_SETTINGS.revisionMode;
    if (!['off', 'counter'].includes(revisionMode))
        throw new Error('Revision mode must be off or counter.');
    const countRenames = value.countRenames ?? DEFAULT_SETTINGS.countRenames;
    if (typeof countRenames !== 'boolean') throw new Error('Count file renames must be a boolean.');
    return {
        countRenames,
        excludedFolders: [...new Set(excludedFolders)],
        properties,
        revisionMode,
    };
}
