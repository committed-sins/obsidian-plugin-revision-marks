import { EXCLUDED_FOLDERS } from './edit-sessions.mjs';
import { DEFAULT_FRONTMATTER_ORDER } from './frontmatter-order.mjs';

export const DEFAULT_SETTINGS = Object.freeze({
    excludedFolders: EXCLUDED_FOLDERS,
    frontmatterOrder: DEFAULT_FRONTMATTER_ORDER
});

export function normalizeSettings(value = {}) {
    const list = (input, fallback) => [...new Set((Array.isArray(input) ? input : fallback)
        .filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
    const excludedFolders = list(value.excludedFolders, DEFAULT_SETTINGS.excludedFolders)
        .map(folder => folder.replaceAll('\\', '/').replace(/\/+$/, ''));
    if (excludedFolders.some(folder => folder.startsWith('/') || folder.includes(':') || folder.split('/').some(part => !part || part === '.' || part === '..'))) {
        throw new Error('Excluded folders must be relative vault folders, one per line.');
    }
    const frontmatterOrder = list(value.frontmatterOrder, DEFAULT_SETTINGS.frontmatterOrder);
    if (frontmatterOrder.some(key => /[\r\n]/.test(key))) throw new Error('Use one frontmatter property name per line.');
    return { excludedFolders: [...new Set(excludedFolders)], frontmatterOrder };
}
