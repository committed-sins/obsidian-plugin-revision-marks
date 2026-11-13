import { Notice, PluginSettingTab, SettingGroup } from 'obsidian';

const PROPERTY_DESCRIPTION =
    'A top-level frontmatter property name. Existing properties are not renamed automatically.';

/** Edits a draft; only Save and apply changes the running plugin's settings. */
export class RevisionMarksSettingsTab extends PluginSettingTab
{
    draft = null;
    revisionNameInput = null;

    display()
    {
        this.containerEl.empty();
        this.containerEl.addClass('revision-marks-settings');
        this.draft = {
            excludedFolders: [...this.plugin.settings.excludedFolders],
            properties: { ...this.plugin.settings.properties },
            revisionMode: this.plugin.settings.revisionMode,
        };
        this.revisionNameInput = null;

        this.renderIntroduction();
        this.renderTimestampSettings();
        this.renderRevisionSettings();
        this.renderGeneralSettings();
    }

    renderIntroduction()
    {
        new SettingGroup(this.containerEl).addSetting((setting) =>
        {
            setting.setName('Track editing sessions, not autosaves');
            setting.setDesc(
                'Timestamps and optional revision counts update when you leave or explicitly save a note.\n' +
                    'Unchanged content and complete undo produce no update, keeping metadata writes out of your typing flow.',
            );
        });
    }

    renderTimestampSettings()
    {
        const group = new SettingGroup(this.containerEl);
        group.addSetting((setting) =>
            this.renderPropertyName(setting, 'created', 'Created property')
        );
        group.addSetting((setting) =>
            this.renderPropertyName(setting, 'updated', 'Updated property')
        );
    }

    renderRevisionSettings()
    {
        const group = new SettingGroup(this.containerEl).setHeading('Revision tracking');
        group.addSetting((setting) => this.renderRevisionMode(setting));
        group.addSetting((setting) =>
            this.renderPropertyName(setting, 'revision', 'Revision property')
        );
    }

    renderRevisionMode(setting)
    {
        setting.setName('Mode');
        setting.setDesc(
            'Off updates timestamps only and preserves existing revision values. Counter adds one per changed session.',
        );
        setting.addDropdown((dropdown) =>
        {
            dropdown.addOption('off', 'Off');
            dropdown.addOption('counter', 'Counter');
            dropdown.setValue(this.draft.revisionMode);
            dropdown.onChange((value) =>
            {
                this.draft.revisionMode = value;
                this.revisionNameInput?.setDisabled(value === 'off');
            });
        });
    }

    renderPropertyName(setting, role, label)
    {
        setting.setName(label);
        setting.setDesc(PROPERTY_DESCRIPTION);
        setting.addText((input) =>
        {
            input.setValue(this.draft.properties[role]);
            input.onChange((value) =>
            {
                this.draft.properties[role] = value;
            });
            if (role === 'revision') {
                this.revisionNameInput = input;
                input.setDisabled(this.draft.revisionMode === 'off');
            }
        });
    }

    renderGeneralSettings()
    {
        const group = new SettingGroup(this.containerEl);
        group.addSetting((setting) => this.renderExcludedFolders(setting));
        group.addSetting((setting) => this.renderApplyButton(setting));
    }

    renderExcludedFolders(setting)
    {
        setting.setName('Excluded folders');
        setting.setDesc(
            'One vault-relative folder per line. Each folder and its subfolders are excluded.',
        );
        setting.addTextArea((input) =>
        {
            input.setValue(this.draft.excludedFolders.join('\n'));
            input.onChange((value) =>
            {
                this.draft.excludedFolders = value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
            });
        });
    }

    renderApplyButton(setting)
    {
        setting.setName('Apply settings');
        setting.setDesc('Completes pending editing sessions before applying the new rules.');
        setting.addButton((button) =>
        {
            button.setButtonText('Save and apply');
            button.setCta();
            button.onClick(() => this.applyDraft());
        });
    }

    async applyDraft()
    {
        try {
            await this.plugin.applySettings(this.draft);
            new Notice('Revision Marks settings applied.');
        } catch (error) {
            new Notice(error.message, 10000);
        }
    }
}
