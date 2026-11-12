import { startEditSessions } from './edit-sessions.mjs';
import { normalizeSettings } from './settings.mjs';

export function createPluginClass(api, startRuntime = startEditSessions) {
    class SettingsTab extends api.PluginSettingTab {
        display() {
            const { containerEl } = this;
            containerEl.empty();
            containerEl.addClass('revision-marks-settings');
            containerEl.createEl('p', {
                cls: 'setting-item-description',
                text: 'Tracks changed editing sessions instead of individual autosaves. Timestamps and revision counts update when you leave or explicitly save a note, keeping metadata writes out of your typing flow. Unchanged content and complete undo produce no update.'
            });
            let excludedFolders = [...this.plugin.settings.excludedFolders];
            let revisionMode = this.plugin.settings.revisionMode;
            const properties = { ...this.plugin.settings.properties };
            let revisionNameInput;
            new api.Setting(containerEl)
                .setName('Revision tracking')
                .setDesc('Off updates timestamps only and preserves existing revision values. Counter adds one per changed session.')
                .addDropdown(dropdown => dropdown.addOption('off', 'Off').addOption('counter', 'Counter')
                    .setValue(revisionMode).onChange(value => {
                        revisionMode = value;
                        revisionNameInput?.setDisabled(value === 'off');
                    }));
            for (const [role, label] of [['created', 'Created property'], ['updated', 'Updated property'], ['revision', 'Revision property']]) {
                new api.Setting(containerEl)
                    .setName(label)
                    .setDesc('A top-level frontmatter property name. Existing properties are not renamed automatically.')
                    .addText(input => {
                        input.setValue(properties[role]).onChange(value => { properties[role] = value; });
                        if (role === 'revision') { revisionNameInput = input; input.setDisabled(revisionMode === 'off'); }
                    });
            }
            new api.Setting(containerEl)
                .setName('Excluded folders')
                .setDesc('One vault-relative folder per line. Each folder and its subfolders are excluded.')
                .addTextArea(input => input.setValue(excludedFolders.join('\n')).onChange(value => {
                    excludedFolders = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
                }));
            new api.Setting(containerEl)
                .setName('Apply settings')
                .setDesc('Completes pending editing sessions before applying the new rules.')
                .addButton(button => button.setButtonText('Save and apply').setCta().onClick(async () => {
                    try {
                        await this.plugin.applySettings({ excludedFolders, properties, revisionMode });
                        new api.Notice('Revision Marks settings applied.');
                    } catch (error) { new api.Notice(error.message, 10000); }
                }));
        }
    }

    return class RevisionMarksPlugin extends api.Plugin {
        settings = normalizeSettings();
        runtime = null;
        restartQueue = Promise.resolve();
        ready = false;
        stopping = false;

        async onload() {
            this.stopping = false;
            try { this.settings = normalizeSettings(await this.loadData() ?? {}); }
            catch (error) {
                new api.Notice(`Revision Marks did not start: ${error.message}`, 10000);
                throw error;
            }
            this.addSettingTab(new SettingsTab(this.app, this));
            this.addCommand({
                id: 'complete-current-session', name: 'Complete current session',
                checkCallback: checking => {
                    const path = this.app.workspace.getActiveFile()?.path;
                    if (!this.runtime || !path?.endsWith('.md')) return false;
                    if (!checking) void this.runtime.complete(path);
                    return true;
                }
            });
            this.addCommand({
                id: 'complete-all-sessions', name: 'Complete all sessions',
                callback: () => this.runtime?.complete()
            });
            this.app.workspace.onLayoutReady(() => {
                if (this.stopping) return;
                this.ready = true;
                void this.restartTracking().catch(error => {
                    console.error('Revision Marks startup failed', error);
                    new api.Notice(`Revision Marks did not start: ${error.message}`, 10000);
                });
            });
        }

        restartTracking() {
            const restart = this.restartQueue.then(async () => {
                const previous = this.runtime;
                this.runtime = null;
                await previous?.();
                if (this.stopping || !this.ready) return;
                this.runtime = startRuntime(this.app, {
                    ...api, owner: this,
                    excludedFolders: this.settings.excludedFolders,
                    properties: this.settings.properties,
                    revisionMode: this.settings.revisionMode,
                    formatDate: iso => api.moment(iso).format('YYYY-MM-DDTHH:mm:ssZ')
                });
            });
            this.restartQueue = restart.catch(() => {});
            return restart;
        }

        async applySettings(value) {
            const settings = normalizeSettings(value);
            // Finish under the old names and exclusions before changing the rules.
            const restart = this.restartQueue.then(async () => {
                const previous = this.runtime;
                await previous?.complete?.();
                if (this.stopping) return;
                this.runtime = null;
                await previous?.();
                if (previous?.pendingPaths?.().length && (JSON.stringify(settings.properties) !== JSON.stringify(this.settings.properties) || settings.revisionMode !== this.settings.revisionMode)) {
                    throw new Error('Pending sessions remain under the old property names or revision mode. Complete them before changing these settings.');
                }
                await this.saveData(settings);
                this.settings = settings;
            });
            this.restartQueue = restart.catch(() => {});
            try { await restart; }
            catch (error) { await this.restartTracking(); throw error; }
            await this.restartTracking();
        }

        async onunload() {
            this.stopping = true;
            this.ready = false;
            const previous = this.runtime;
            this.runtime = null;
            // Obsidian need not await this hook. Invalidate the writer synchronously.
            const checkpoint = previous?.();
            await this.restartQueue;
            await checkpoint;
        }
    };
}
