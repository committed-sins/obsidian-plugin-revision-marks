export function sessionStorageKey(vaultIdentity, properties) {
    return 'session-marks.v2:' + vaultIdentity + ':' + encodeURIComponent(JSON.stringify([
        properties.created, properties.updated, properties.revision
    ]));
}

export function prepareSessionStorage(storage, vaultIdentity, properties) {
    const key = sessionStorageKey(vaultIdentity, properties);
    const legacyKey = 'session-marks.v1:' + vaultIdentity;
    const legacyNames = properties.created === 'created' && properties.updated === 'updated' && properties.revision === 'updated_count';
    const legacy = storage.getItem(legacyKey);
    if (storage.getItem(key)) {
        if (legacy && legacyNames && !storage.getItem(legacyKey + ':migrated')) storage.setItem(legacyKey + ':migrated', key);
        return key;
    }
    if (!legacy || storage.getItem(legacyKey + ':migrated')) return key;
    const journal = JSON.parse(legacy);
    if (journal.version !== 1 || !Array.isArray(journal.entries)) throw new Error('Unknown previous Session Marks journal format; existing state retained.');
    if (!legacyNames) {
        if (journal.entries.length) throw new Error('Previous Session Marks sessions are pending. Set the revision property to updated_count first to recover them before changing names.');
        return key;
    }
    // Copy, never delete, previous preview state. Only the exact old field mapping
    // can interpret its fingerprints and counters correctly.
    storage.setItem(key, legacy);
    const baselines = storage.getItem(legacyKey + ':baselines');
    if (baselines) storage.setItem(key + ':baselines', baselines);
    storage.setItem(legacyKey + ':migrated', key);
    return key;
}
