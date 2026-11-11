export const DEFAULT_PROPERTIES = Object.freeze({ created: 'created', updated: 'updated', revision: 'revision' });

export function propertyNames(api) {
    return api.properties ?? DEFAULT_PROPERTIES;
}

export function normalizeProperties(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Property names must be an object with created, updated and revision names.');
    const properties = Object.fromEntries(Object.entries(DEFAULT_PROPERTIES).map(([role, fallback]) => {
        const name = value[role] === undefined ? fallback : value[role];
        if (typeof name !== 'string' || !name.trim() || /[\r\n\0]/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name.trim())) {
            throw new Error(`Use a non-empty top-level property name for ${role}.`);
        }
        return [role, name.trim()];
    }));
    if (new Set(Object.values(properties)).size !== 3) throw new Error('Created, updated and revision must use distinct property names.');
    return properties;
}
