import {
    attachmentFolderExclusions,
    DEFAULT_EXCLUDED_FOLDERS,
    normalizeExcludedFolder,
} from './note-paths.mjs';
import { DEFAULT_PROPERTIES, normalizeProperties } from './properties.mjs';

export const DEFAULT_SETTINGS = Object.freeze({
    revisionMode: 'counter',
    countRenames: true,
    countLinkUpdates: false,
    initialRevision: 0,
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
        normalizeExcludedFolder,
    );
    const properties = normalizeProperties(value.properties);
    const revisionMode = value.revisionMode ?? DEFAULT_SETTINGS.revisionMode;
    if (!['off', 'counter'].includes(revisionMode))
        throw new Error('Revision mode must be off or counter.');
    const countRenames = value.countRenames ?? DEFAULT_SETTINGS.countRenames;
    if (typeof countRenames !== 'boolean') throw new Error('Count file renames must be a boolean.');
    const countLinkUpdates = value.countLinkUpdates ?? DEFAULT_SETTINGS.countLinkUpdates;
    if (typeof countLinkUpdates !== 'boolean')
        throw new Error('Count link updates must be a boolean.');
    const initialRevision = value.initialRevision ?? DEFAULT_SETTINGS.initialRevision;
    if (
        !Number.isSafeInteger(initialRevision) || initialRevision < 0 ||
        initialRevision >= Number.MAX_SAFE_INTEGER
    )
        throw new Error(
            'Initial revision must be a non-negative safe integer below the maximum counter value.',
        );
    return {
        countRenames,
        countLinkUpdates,
        initialRevision,
        excludedFolders: [...new Set(excludedFolders)],
        properties,
        revisionMode,
    };
}

/** Read setup defaults once; null means configuration is unavailable and setup should retry. */
export async function attachmentDefaults(vault)
{
    if (!vault?.adapter?.read) return null;
    try {
        const configDir = vault.configDir ?? '.obsidian';
        const config = JSON.parse(await vault.adapter.read(configDir + '/app.json'));
        return attachmentFolderExclusions(config.attachmentFolderPath);
    } catch {
        // Missing/unreadable optional configuration must not prevent tracking.
        return null;
    }
}
