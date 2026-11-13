// Vault-relative scope shared by settings and tracking.
export const EXCLUDED_FOLDERS = ['archives', 'scripts', 'libraries', 'templates', 'inbound'];

export const eligibleNote = (path, excludedFolders = EXCLUDED_FOLDERS) =>
    path.endsWith('.md') &&
    !excludedFolders.some((folder) => path === folder || path.startsWith(folder + '/'));
