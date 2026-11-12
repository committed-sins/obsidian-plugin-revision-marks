export function sessionStorageKey(vaultIdentity, properties) {
    return 'revision-marks.v2:' + vaultIdentity + ':' + encodeURIComponent(JSON.stringify([
        properties.created, properties.updated, properties.revision
    ]));
}

export function prepareSessionStorage(storage, vaultIdentity, properties) {
    const key = sessionStorageKey(vaultIdentity, properties);
    const previousKey = key.replace(/^revision-marks\.v2:/, 'session-marks.v2:');
    const legacyKey = 'session-marks.v1:' + vaultIdentity;
    const legacyNames = properties.created === 'created' && properties.updated === 'updated' && properties.revision === 'updated_count';
    const legacy = storage.getItem(legacyKey);
    if (storage.getItem(key)) {
        if (legacy && legacyNames && !storage.getItem(legacyKey + ':migrated')) storage.setItem(legacyKey + ':migrated', key);
        return key;
    }
    // The rename changes identity, not fingerprints or property mappings. Copy
    // compatible state byte-for-byte and retain originals. Copy baselines first:
    // an interrupted copy must not make a present journal hide missing baselines.
    const previous = storage.getItem(previousKey);
    const previousBaselines = storage.getItem(previousKey + ':baselines');
    if (previousBaselines) storage.setItem(key + ':baselines', previousBaselines);
    if (previous) {
        storage.setItem(key, previous);
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
    const baselines = storage.getItem(legacyKey + ':baselines');
    if (baselines) storage.setItem(key + ':baselines', baselines);
    storage.setItem(key, legacy);
    storage.setItem(legacyKey + ':migrated', key);
    return key;
}
