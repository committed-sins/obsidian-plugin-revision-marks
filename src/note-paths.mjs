// Vault-relative scope shared by settings and tracking.
export const DEFAULT_EXCLUDED_FOLDERS = Object.freeze([]);

export const eligibleNote = (path, excludedFolders = DEFAULT_EXCLUDED_FOLDERS) =>
    path.endsWith('.md') &&
    !excludedFolders.some((folder) => path === folder || path.startsWith(folder + '/'));
