import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const within = (parent, child) =>
{
    const relative = path.relative(parent, child);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

export async function deploy({ root, configName = '.obsidian', artifacts = 'dist' })
{
    if (!root) throw new Error('Set OBSIDIAN_VAULT to the test vault root.');
    const vault = await fs.realpath(path.resolve(root));
    if (path.isAbsolute(configName) || configName.split(/[\\/]/).some((part) => part === '..')) {
        throw new Error('OBSIDIAN_CONFIG_DIR must be a relative directory within the vault.');
    }
    const config = await fs.realpath(path.join(vault, configName));
    if (!within(vault, config)) throw new Error('Config directory resolves outside the vault.');
    const manifest = JSON.parse(await fs.readFile(path.join(artifacts, 'manifest.json'), 'utf8'));
    if (manifest.id !== 'revision-marks') throw new Error('Expected the Revision Marks plugin ID.');
    const plugins = path.join(config, 'plugins');
    await fs.mkdir(plugins, { recursive: true });
    const pluginsReal = await fs.realpath(plugins);
    if (!within(config, pluginsReal))
        throw new Error('Plugins directory resolves outside the config directory.');
    const target = path.join(pluginsReal, manifest.id);
    await fs.mkdir(target, { recursive: true });
    const targetReal = await fs.realpath(target);
    if (!within(pluginsReal, targetReal))
        throw new Error('Plugin directory resolves outside the plugins directory.');
    const files = ['main.js', 'manifest.json', 'styles.css'];
    // Validate every destination before overwriting any artifact. Never touch
    // data.json, community-plugins.json, other plugins, notes or workspace state.
    for (const file of files) {
        try {
            if ((await fs.lstat(path.join(targetReal, file))).isSymbolicLink())
                throw new Error('Refusing symlink: ' + file);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        await fs.access(path.join(artifacts, file));
    }
    for (const file of files)
        await fs.copyFile(path.join(artifacts, file), path.join(targetReal, file));
    return targetReal;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const explicitVault = process.env.OBSIDIAN_VAULT;
    const explicitConfig = process.env.OBSIDIAN_CONFIG_DIR;
    try {
        process.loadEnvFile('.env.local');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    const target = await deploy({
        root: explicitVault ?? process.env.OBSIDIAN_VAULT,
        configName: explicitConfig ?? process.env.OBSIDIAN_CONFIG_DIR ?? '.obsidian',
    });
    console.log(`Deployed Revision Marks to ${target}. Enable/reload it manually in this vault.`);
}
