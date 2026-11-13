import {
    Plugin,
    Notice,
    Platform,
    editorInfoField,
    getFrontMatterInfo,
    parseYaml,
    moment,
} from 'obsidian';
import { EditorView } from '@codemirror/view';
import { startEditSessions } from './obsidian-runtime.mjs';
import { RevisionMarksSettingsTab } from './settings-tab.mjs';
import { normalizeSettings } from './settings.mjs';

/** Owns Obsidian registrations, persisted settings and serialized runtime restarts. */
export default class RevisionMarksPlugin extends Plugin
{
    settings = normalizeSettings();
    /** @type {import('./obsidian-runtime.mjs').TrackingRuntime | null} */
    runtime = null;
    restartQueue = Promise.resolve();
    ready = false;
    stopping = false;

    async onload()
    {
        this.stopping = false;
        await this.loadSettings();
        this.addSettingTab(new RevisionMarksSettingsTab(this.app, this));
        this.registerCommands();
        this.app.workspace.onLayoutReady(() => this.onWorkspaceReady());
    }

    async loadSettings()
    {
        try {
            const saved = await this.loadData();
            this.settings = normalizeSettings(saved ?? {});
        } catch (error) {
            new Notice(`Revision Marks did not start: ${error.message}`, 10000);
            throw error;
        }
    }

    registerCommands()
    {
        this.addCommand({
            id: 'complete-current-session',
            name: 'Complete current session',
            checkCallback: (checking) => this.completeCurrentSession(checking),
        });
        this.addCommand({
            id: 'complete-all-sessions',
            name: 'Complete all sessions',
            callback: () => this.runtime?.complete(),
        });
    }

    completeCurrentSession(checking)
    {
        const path = this.app.workspace.getActiveFile()?.path;
        if (!this.runtime || !path?.endsWith('.md')) return false;
        if (!checking) void this.runtime.complete(path);
        return true;
    }

    onWorkspaceReady()
    {
        if (this.stopping) return;
        this.ready = true;
        void this.restartTracking().catch((error) =>
        {
            console.error('Revision Marks startup failed', error);
            new Notice(`Revision Marks did not start: ${error.message}`, 10000);
        });
    }

    enqueueRestart(operation)
    {
        const restart = this.restartQueue.then(operation);
        // Keep the queue usable after failure, while its caller still sees the error.
        this.restartQueue = restart.catch(() =>
        {});
        return restart;
    }

    restartTracking()
    {
        return this.enqueueRestart(async () =>
        {
            const previous = this.runtime;
            this.runtime = null;
            await previous?.stop();
            if (this.stopping || !this.ready) return;

            this.runtime = this.createRuntime({
                owner: this,
                EditorView,
                editorInfoField,
                getFrontMatterInfo,
                parseYaml,
                Notice,
                Platform,
                excludedFolders: this.settings.excludedFolders,
                properties: this.settings.properties,
                revisionMode: this.settings.revisionMode,
                formatDate: (iso) => moment(iso).format('YYYY-MM-DDTHH:mm:ssZ'),
            });
        });
    }

    /** Allows lifecycle tests to replace the runtime without changing Obsidian's class. */
    createRuntime(options)
    {
        return startEditSessions(this.app, options);
    }

    hasTrackingRuleChanges(settings)
    {
        const namesChanged =
            JSON.stringify(settings.properties) !== JSON.stringify(this.settings.properties);
        const modeChanged = settings.revisionMode !== this.settings.revisionMode;
        return namesChanged || modeChanged;
    }

    async applySettings(value)
    {
        const settings = normalizeSettings(value);
        const restart = this.enqueueRestart(async () =>
        {
            // Complete and checkpoint under the old names/mode before replacing the rules.
            const previous = this.runtime;
            await previous?.complete();
            if (this.stopping) return;
            this.runtime = null;
            await previous?.stop();

            const hasPendingSessions = previous?.pendingPaths().length > 0;
            if (hasPendingSessions && this.hasTrackingRuleChanges(settings)) {
                throw new Error(
                    'Pending sessions remain under the old property names or revision mode. ' +
                        'Complete them before changing these settings.',
                );
            }
            await this.saveData(settings);
            this.settings = settings;
        });

        try {
            await restart;
        } catch (error) {
            await this.restartTracking();
            throw error;
        }
        await this.restartTracking();
    }

    async onunload()
    {
        this.stopping = true;
        this.ready = false;
        const previous = this.runtime;
        this.runtime = null;
        // Obsidian need not await this hook. Invalidate the writer before any await.
        const checkpoint = previous?.stop();
        await this.restartQueue;
        await checkpoint;
    }
}
