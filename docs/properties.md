# Session properties

Configure three distinct top-level names under Session Marks settings. Defaults:

```yaml
created: 2026-11-11T15:00:00+01:00
updated: 2026-11-11T15:00:00+01:00
revision: 1
```

The revision property can also be named `updated_count`, `updated_revision`, or another chosen name. No existing property is renamed automatically, and changing names does not transfer values from the former names. Keep the existing counter name when retaining its current count; field migration is a separate operation.

## When values are filled

These rules apply when committing a genuinely changed session, not when merely opening or initially indexing a note. A complete undo still causes no write.

- Preserve a creation property that already exists. If its key is absent, set it to exactly the final updated value (including timezone spelling). An existing empty/null property is retained rather than overwritten.
- Only advance a valid updated timestamp; keep a timestamp already equal to or later than the proposed mtime. A newly filled creation date matches that retained value too.
- Increment the configured revision counter once. An absent/null counter starts at zero; invalid non-numeric values fail without overwriting them.
- Recovery records include the expected post-insertion content fingerprint so filling creation metadata does not become a second revision after interruption.

## Placement

The semantic order is always **creation, update, revision**, using the configured names.

1. All three keys exist: update values in place. Preserve every existing key position, even if the three fields were manually reordered or separated by other properties.
2. At least one key is missing, but another session key exists: form one contiguous block at the first existing session key's position. Preserve unrelated properties' relative order and values.
3. None of the three keys exists: append the block after all existing properties. In a note without frontmatter, this creates the three-key frontmatter block.

For example, a partial note:

```yaml
id: stable-id
tags: [example]
updated: 2026-11-10T12:00:00+01:00
status: active
```

After a changed session:

```yaml
id: stable-id
tags: [example]
created: 2026-11-11T15:00:00+01:00
updated: 2026-11-11T15:00:00+01:00
revision: 1
status: active
```

There is no vault-wide property sorter. Obsidian's frontmatter writer may still normalize YAML formatting; the plugin preserves unrelated values and their relative property order.

## Name changes and pending state

Applying settings first completes sessions under the old names. If any remain unresolved, changing names is refused and tracking resumes with the previous settings. Recovery namespaces include the names, so fingerprints of one mapping cannot silently be used for another.

Pending state from plugin preview 0.1.0 can be recovered with its original `created`/`updated`/`updated_count` mapping. The new default `revision` does not implicitly rename or adopt `updated_count` values. Neither preview modifies Continuum automatically.
