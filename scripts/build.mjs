import { build } from 'esbuild';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const versions = JSON.parse(await readFile('versions.json', 'utf8'));
if (manifest.id !== 'session-marks' || pkg.version !== manifest.version || versions[manifest.version] !== manifest.minAppVersion) {
    throw new Error('Plugin identity or version metadata is inconsistent.');
}
await mkdir('dist', { recursive: true });
await build({
    entryPoints: ['src/main.mjs'], outfile: 'dist/main.js', bundle: true,
    external: ['obsidian', '@codemirror/view'], platform: 'browser', format: 'cjs',
    target: 'es2022', sourcemap: false,
    banner: { js: '/* Session Marks development build. See the source repository. */' }
});
for (const file of ['manifest.json', 'styles.css']) await copyFile(file, 'dist/' + file);
console.log(`Built ${manifest.name} ${manifest.version} in dist/`);
