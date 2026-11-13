import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deploy } from '../scripts/deploy.mjs';

test('deployment copies only plugin artifacts and preserves settings, activation and notes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revision-marks-deploy-'));
    try {
        const vault = path.join(root, 'vault'),
            artifacts = path.join(root, 'dist');
        const target = path.join(vault, '.obsidian', 'plugins', 'revision-marks');
        await fs.mkdir(target, { recursive: true });
        await fs.mkdir(artifacts);
        await fs.writeFile(path.join(artifacts, 'manifest.json'), '{"id":"revision-marks"}');
        await fs.writeFile(path.join(artifacts, 'main.js'), 'build');
        await fs.writeFile(path.join(artifacts, 'styles.css'), 'styles');
        await fs.writeFile(path.join(target, 'data.json'), '{"keep":true}');
        await fs.writeFile(path.join(vault, '.obsidian', 'community-plugins.json'), '["existing"]');
        await fs.writeFile(path.join(vault, 'Note.md'), 'untouched');
        assert.equal(await deploy({ root: vault, artifacts }), await fs.realpath(target));
        assert.equal(await fs.readFile(path.join(target, 'main.js'), 'utf8'), 'build');
        assert.equal(await fs.readFile(path.join(target, 'data.json'), 'utf8'), '{"keep":true}');
        assert.equal(
            await fs.readFile(path.join(vault, '.obsidian', 'community-plugins.json'), 'utf8'),
            '["existing"]',
        );
        assert.equal(await fs.readFile(path.join(vault, 'Note.md'), 'utf8'), 'untouched');
        await assert.rejects(
            deploy({ root: vault, artifacts, configName: '../outside' }),
            /relative directory/,
        );
    } finally {
        const resolved = await fs.realpath(root);
        assert.ok(path.basename(resolved).startsWith('revision-marks-deploy-'));
        assert.equal(path.dirname(resolved), await fs.realpath(os.tmpdir()));
        await fs.rm(resolved, { recursive: true });
    }
});
