# Community-directory submission

The repository owner submits the plugin; publication of a GitHub release alone does not add it to the Obsidian directory.

## First beta

- Repository: `committed-sins/obsidian-plugin-revision-marks`
- Plugin ID: `revision-marks`
- Version/tag: `0.1.7`
- License: MIT
- Release assets: `main.js`, `manifest.json`, `styles.css`
- Beta identification: README, plugin description, settings introduction and release notes.

The manifest uses a plain `x.y.z` version for Obsidian compatibility. The Community publisher requires a regular GitHub release matching that version; do not mark it as a prerelease. Beta status stays explicit in the text rather than the version or GitHub release flag. The build embeds the MIT license in `main.js` so installed copies retain the notice.

## Submit

1. Sign in at [Obsidian Community](https://community.obsidian.md/) and link the GitHub account that can manage this repository.
2. Use the portal's add-plugin flow and select the repository. The directory reads the root `manifest.json` from the default branch.
3. Verify the displayed name, description, minimum Obsidian version and release assets, then submit/publish from the portal yourself.
4. Address any automated review feedback before availability in the directory. Report the beta/live-test limitations accurately.

See Obsidian's [current submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin). Until accepted, the GitHub release supports manual installation; modern BRAT can also install prereleases.

## Later releases

Update `manifest.json`, `package.json`, `package-lock.json`, `versions.json` and the changelog. Run `npm run check`, commit with a verified signature, tag the same version and attach the three `dist/` files to the matching release. Never include settings, recovery data or vault notes. A first-submission review does not establish Android lifecycle correctness; keep beta notes current until live validation is complete.
