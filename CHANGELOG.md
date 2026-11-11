# Changelog

## 0.1.1

- Configure the creation, update and revision property names; use `revision` as the new default counter name.
- Fill an absent creation property with the final updated timestamp when a changed session completes.
- Complete missing session fields as a contiguous creation/update/revision block beside existing session fields, or append the block if none exist.
- Preserve complete manually arranged blocks and unrelated property order; remove global frontmatter sorting.
- Scope recovery by property names, preserve previous-preview state and avoid counting creation-field insertion twice after an interrupted commit.

## 0.1.0

- Extract the current Continuum session helper into a standalone development preview without CodeScript Toolkit or Templater dependencies.
- Add settings, completion commands, build/tests and targeted test-vault deployment.
