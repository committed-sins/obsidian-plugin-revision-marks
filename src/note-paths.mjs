// Vault-relative scope shared by settings and tracking.
export const DEFAULT_EXCLUDED_FOLDERS = Object.freeze([]);

export function normalizeExcludedFolder(value)
{
    const folder = value.trim().replaceAll('\\', '/').replace(/\/+$/, '').replace(/\/\*\*$/, '');
    const recursive = folder.startsWith('**/');
    const relative = recursive ? folder.slice(3) : folder;
    if (
        !relative || relative.startsWith('/') || relative.includes(':') ||
        /[*?]/.test(relative) ||
        relative.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
        throw new Error(
            'Excluded folders must be vault-relative paths or **/folder patterns, one per line.',
        );
    }
    return folder;
}

export function attachmentFolderExclusions(value)
{
    if (typeof value !== 'string') return [];
    value = value.trim().replaceAll('\\', '/');
    // Root and same-as-note locations must never exclude the note directories.
    if (!value || value === '/' || value === '.' || value === './') return [];
    const folder = value.startsWith('./') ? '**/' + value.slice(2) : value;
    return [normalizeExcludedFolder(folder)];
}

/** Compile once per runtime; folder patterns also match all descendants. */
export function createNoteMatcher(
    excludedFolders = DEFAULT_EXCLUDED_FOLDERS,
    configDir = '.obsidian',
)
{
    const config = normalizeExcludedFolder(configDir);
    const patterns = excludedFolders.map((value) =>
    {
        const folder = normalizeExcludedFolder(value);
        return { recursive: folder.startsWith('**/'), folder: folder.replace(/^\*\*\//, '') };
    });
    return (path) =>
    {
        if (typeof path !== 'string' || !path.endsWith('.md') || path.includes('\\')) return false;
        const parts = path.split('/');
        if (parts.some((part) => !part || part.startsWith('.'))) return false;
        if (path === config || path.startsWith(config + '/')) return false;
        const parents = parts.slice(0, -1).join('/');
        return !patterns.some(({ recursive, folder }) =>
            parents === folder || parents.startsWith(folder + '/') ||
            (recursive && ('/' + parents + '/').includes('/' + folder + '/'))
        );
    };
}

export const eligibleNote = (
    path,
    excludedFolders = DEFAULT_EXCLUDED_FOLDERS,
    configDir = '.obsidian',
) => createNoteMatcher(excludedFolders, configDir)(path);
